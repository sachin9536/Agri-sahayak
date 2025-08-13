from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.prompts import PromptTemplate
from dotenv import load_dotenv
import os
from .database import (
    get_db_connection,
    insert_user,
    insert_conversation,
    fetch_conversations,
    fetch_user_by_id,
    fetch_user_conversation_summaries,
    fetch_conversation_by_id,
    fetch_user_by_email,
    hash_password,
    verify_password,
)
from langchain.chains.question_answering import load_qa_chain
from langchain_community.vectorstores import FAISS
from typing import Optional
import base64

load_dotenv()
router = APIRouter()

# Load environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise HTTPException(status_code=500, detail="Google API key not found.")

GLOBAL_INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "global_faiss_index")
_global_vector_store: Optional[FAISS] = None

class CreateProfileRequest(BaseModel):
    name: str
    email: str
    password: str
    district: Optional[str] = None
    crop: Optional[str] = None
    state: Optional[str] = None


class AskRequest(BaseModel):
    user_id: str
    question: str
    conversation_id: Optional[str] = None


class AnalyzeImageRequest(BaseModel):
    user_id: str
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"
    question: Optional[str] = None
    conversation_id: Optional[str] = None


def _load_global_vector_store() -> FAISS:
    global _global_vector_store
    if _global_vector_store is None:
        if not os.path.isdir(GLOBAL_INDEX_DIR):
            raise HTTPException(status_code=500, detail="Global FAISS index not found. Run ingestion script first.")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        _global_vector_store = FAISS.load_local(
            GLOBAL_INDEX_DIR,
            embeddings,
            allow_dangerous_deserialization=True,
        )
    return _global_vector_store


def get_conversational_chain():
    prompt_template = (
        "You are Agri-Sahayak, a helpful AI advisor for Indian farmers. "
        "Based on the following context from agricultural guides, answer the user's question.\n"
        "Context: {context}\n"
        "Question: {question}"
    )
    model = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.2)
    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
    chain = load_qa_chain(model, chain_type="stuff", prompt=prompt)
    return chain

@router.post("/create_profile")
async def create_profile(req: CreateProfileRequest):
    # Enforce unique email
    existing = fetch_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash = hash_password(req.password)
    user_id = insert_user(
        name=req.name,
        district=req.district,
        crop=req.crop,
        state=req.state,
        email=req.email,
        password_hash=password_hash,
    )
    return {"user_id": user_id, "name": req.name}


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(req: LoginRequest):
    user = fetch_user_by_email(req.email)
    if not user or not user.get("password_hash") or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user_id": user["id"], "name": user["name"]}


class LogoutRequest(BaseModel):
    user_id: str


@router.post("/logout")
async def logout(_: LogoutRequest):
    # Stateless API; frontend should clear its local session storage
    return {"ok": True}


@router.get("/health/index/{user_id}")
async def health_check_index(user_id: str):
    """Return readiness of state-specific FAISS index for this user.

    Always 200 with { ready: bool, state: str | None, reason?: str }
    """
    user = fetch_user_by_id(user_id)
    if not user:
        return {"ready": False, "state": None, "reason": "User not found"}

    user_state = (user.get("state") or "").strip().lower().replace(" ", "_")
    if not user_state:
        return {"ready": False, "state": None, "reason": "User state not set"}

    index_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), f"{user_state}_faiss_index")
    if not os.path.isdir(index_dir):
        return {"ready": False, "state": user_state, "reason": f"Missing index dir {user_state}_faiss_index"}

    return {"ready": True, "state": user_state}


@router.post("/ask")
async def ask(req: AskRequest):
    # Validate user exists
    user = fetch_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Determine user's state and load the matching FAISS index
    user_state = (user.get("state") or "").strip().lower().replace(" ", "_")
    if not user_state:
        raise HTTPException(status_code=400, detail="User state is not set. Please update profile.")

    index_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), f"{user_state}_faiss_index")
    if not os.path.isdir(index_dir):
        raise HTTPException(status_code=500, detail=f"FAISS index for state '{user_state}' not found. Run ingestion for this state.")

    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    vector_store = FAISS.load_local(index_dir, embeddings, allow_dangerous_deserialization=True)
    docs = vector_store.similarity_search(question, k=4)

    chain = get_conversational_chain()
    response = chain.invoke({"input_documents": docs, "question": question})
    answer = response.get("output_text") if isinstance(response, dict) else str(response)

    # Persist conversation with conversation_id
    conv_id = req.conversation_id or str(os.urandom(16).hex())
    insert_conversation(req.user_id, question, answer, conversation_id=conv_id)

    return {"answer": answer, "conversation_id": conv_id}


@router.post("/analyze_image")
async def analyze_image(req: AnalyzeImageRequest):
    """Analyze a crop image using a multimodal Gemini model and return a simple description."""
    user = fetch_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        image_bytes = base64.b64decode(req.image_base64)
        base_prompt = (
            "You are an agricultural expert. Analyze this image of a crop leaf from a farmer. "
            "In simple terms, describe any visible signs of disease, pests, or nutrient deficiency. "
            "If the leaf looks healthy, state that."
        )
        extra = (req.question or "").strip()
        full_prompt = base_prompt if not extra else f"{base_prompt}\nAdditional question/instructions: {extra}"
        result = model.generate_content([
            full_prompt,
            {"mime_type": req.mime_type or "image/jpeg", "data": image_bytes},
        ])
        text = (result.text or "").strip()
        if not text:
            text = "I could not extract a description from the image. Please try another photo with good lighting and focus."
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {e}")

    conv_id = req.conversation_id or str(os.urandom(16).hex())
    question_text = (req.question or "Analyze crop image").strip() or "Analyze crop image"
    insert_conversation(req.user_id, question_text, text, conversation_id=conv_id)
    return {"answer": text, "conversation_id": conv_id}


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = fetch_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


@router.get("/users/{user_id}/suggestions")
async def get_startup_suggestions(user_id: str):
    """Return 3-4 contextually relevant starter questions based on user's profile.

    This is heuristic and can be improved later; for now we branch on crop/state.
    """
    user = fetch_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    state = (user.get("state") or "").strip()
    crop = (user.get("crop") or "").strip()
    lower_state = state.lower()
    lower_crop = crop.lower()

    suggestions: list[str] = []

    # Crop-specific suggestions
    if "wheat" in lower_crop:
        suggestions += [
            "What is the best fertilizer dose for wheat?",
            f"Show me current market prices for wheat in {state or 'my state'}",
            "How can I control rust or other common wheat diseases?",
        ]
    elif "rice" in lower_crop or "paddy" in lower_crop:
        suggestions += [
            "Recommend a nutrient schedule for rice",
            f"What is the recommended paddy variety for {state or 'my region'}?",
            "Best water management practices for transplanted paddy?",
        ]
    elif "cotton" in lower_crop:
        suggestions += [
            "How do I manage bollworm infestation?",
            f"What is the ideal sowing window for cotton in {state or 'my state'}?",
            "Suggest an IPM plan for cotton pests",
        ]
    elif "sugarcane" in lower_crop:
        suggestions += [
            "What is the recommended fertilizer schedule for sugarcane?",
            "How to improve ratoon crop yield in sugarcane?",
            f"Any subsidy schemes for sugarcane planters in {state or 'my state'}?",
        ]

    # State/market/credit generics
    suggestions += [
        f"Show me current market prices for {crop or 'my crop'} in {state or 'my state'}",
        "What are the best practices for soil health and testing?",
        "How can I get a loan or subsidy for new farm machinery?",
    ]

    # Deduplicate while preserving order
    seen = set()
    unique_suggestions: list[str] = []
    for s in suggestions:
        if s and s not in seen:
            unique_suggestions.append(s)
            seen.add(s)

    # Limit to 4
    return {"suggestions": unique_suggestions[:4]}

# @router.get("/get_conversation/")
# async def get_conversation(pdf_id: str):
#     if pdf_id not in conversations:
#         raise HTTPException(status_code=404, detail="No conversation history found for this PDF.")
    
#     return {"conversation": conversations[pdf_id]}

@router.get("/users/{user_id}/conversations")
async def list_user_conversations(user_id: str):
    summaries = fetch_user_conversation_summaries(user_id)
    # Ensure stable keys
    conversations = [
        {"conversation_id": s["conversation_id"], "title": s["title"], "timestamp": s["first_timestamp"]}
        for s in summaries
    ]
    return {"conversations": conversations}


@router.get("/conversations/{conversation_id}")
async def get_conversation_by_id_route(conversation_id: str):
    rows = fetch_conversation_by_id(conversation_id)
    conversation = [
        {"question": row["question"], "answer": row["answer"], "timestamp": row["timestamp"]}
        for row in rows
    ]
        return {"conversation": conversation}

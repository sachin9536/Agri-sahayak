import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Send, AlertCircle, Paperclip, Mic } from "lucide-react";
import { IconButton, Box, Button, SimpleGrid, Text } from "@chakra-ui/react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

const ConversationHistory = ({
  conversation,
  isLoading,
  error,
  endRef,
  onSpeak,
  isSpeaking,
}) => (
  <div className="conversation">
    {error && (
      <div className="error">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    )}

    {conversation.map((entry, index) => (
      <div key={index} className="message">
        <div className="question">{entry.question}</div>
        {entry.answer !== null ? (
          <div className="answer">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>{entry.answer}</div>
              <button
                onClick={() => onSpeak?.(entry.answer)}
                aria-label={isSpeaking ? "Stop reading" : "Read answer"}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {isSpeaking ? "⏹️" : "🔊"}
              </button>
            </div>
          </div>
        ) : (
          <div className="loading">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        )}
      </div>
    ))}
    <div ref={endRef} />
    {isLoading && conversation.length === 0 && (
      <div className="loading">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
    )}
  </div>
);

const QuestionInput = ({
  question,
  setQuestion,
  onSend,
  isLoading,
  disabled,
  onVoiceInput,
  isListening,
  onAttach,
  hasPendingImage,
}) => {
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <div className="input-section">
      <div className="input-container">
        <IconButton
          aria-label="Attach"
          variant="ghost"
          isDisabled={isLoading}
          title="Attach"
          onClick={onAttach}
        >
          <Paperclip size={18} />
        </IconButton>
        <IconButton
          aria-label={isListening ? "Listening..." : "Voice input"}
          variant={isListening ? "solid" : "ghost"}
          colorScheme={isListening ? "blue" : undefined}
          isDisabled={isLoading}
          onClick={onVoiceInput}
          title="Voice input"
        >
          <Mic size={18} />
        </IconButton>
        <textarea
          className="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            hasPendingImage
              ? "Add a note about the image or press Send..."
              : "Ask your question..."
          }
          disabled={isLoading}
        />
        <button
          className="send-button"
          onClick={() => onSend()}
          disabled={
            isLoading || (!question.trim() && !hasPendingImage) || disabled
          }
        >
          <Send size={20} />
        </button>
      </div>
      {hasPendingImage && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
          Image attached. It will be analyzed when you press Send.
        </div>
      )}
    </div>
  );
};

const Chat = ({
  userId,
  conversationId,
  onConversationIdChange,
  indexReady,
}) => {
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { base64, mime }

  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Keep input synced with mic transcript
  useEffect(() => {
    if (transcript) setQuestion(transcript);
  }, [transcript]);

  // Fetch conversation history whenever a conversation is selected
  useEffect(() => {
    if (!conversationId) {
      setConversation([]);
      // fetch startup suggestions for new chat
      (async () => {
        try {
          if (!userId) return;
          const res = await axios.get(
            `http://127.0.0.1:8000/users/${userId}/suggestions`
          );
          setSuggestions(res?.data?.suggestions || []);
        } catch (_) {
          setSuggestions([]);
        }
      })();
      return;
    }
    (async () => {
      try {
        const res = await axios.get(
          `http://127.0.0.1:8000/conversations/${conversationId}`
        );
        const history = res?.data?.conversation ?? [];
        setConversation(history);
        setError(null);
        setSuggestions([]);
      } catch (err) {
        setError("Failed to load conversation history.");
      }
    })();
  }, [conversationId, userId]);

  const handleSend = async (overrideQuestion) => {
    const text = overrideQuestion ?? question;
    const trimmed = typeof text === "string" ? text.trim() : "";
    const hasImage = !!pendingImage;
    if (!trimmed && !hasImage) return;

    setError(null);
    setIsLoading(true);
    if (overrideQuestion === undefined) setQuestion("");

    // Decide which endpoint
    const placeholderQuestion = hasImage
      ? trimmed || "Analyze crop image"
      : trimmed;

    setConversation((prev) => [
      ...prev,
      {
        question: placeholderQuestion,
        answer: null,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const uid = localStorage.getItem("user_id") || userId;
      let res;
      if (hasImage) {
        res = await axios.post("http://127.0.0.1:8000/analyze_image", {
          user_id: uid,
          image_base64: pendingImage.base64,
          mime_type: pendingImage.mime,
          question: trimmed || null,
          conversation_id: conversationId || null,
        });
      } else {
        res = await axios.post("http://127.0.0.1:8000/ask", {
          user_id: uid,
          question: trimmed,
          conversation_id: conversationId || null,
        });
      }
      const answer = res?.data?.answer ?? "";
      const returnedConversationId = res?.data?.conversation_id;
      if (!conversationId && returnedConversationId && onConversationIdChange) {
        onConversationIdChange(returnedConversationId);
      }
      setSuggestions([]);
      setConversation((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0) {
          updated[lastIndex] = { ...updated[lastIndex], answer };
        }
        return updated;
      });
    } catch (err) {
      setError("Failed to get answer. Please try again.");
      setConversation((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setPendingImage(null);
    }
  };

  const handleSuggestionClick = async (text) => {
    if (!text) return;
    handleSend(text);
  };

  const toggleVoice = () => {
    try {
      if (listening) {
        SpeechRecognition.stopListening();
        return;
      }
      resetTranscript();
      SpeechRecognition.startListening({
        continuous: false,
        language: "en-IN",
      });
    } catch {}
  };

  const handleSpeak = (text) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      if (synth.speaking || isSpeaking) {
        synth.cancel();
        setIsSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text || "");
      utterance.lang = "en-IN";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      synth.cancel();
      synth.speak(utterance);
    } catch {}
  };

  const openFilePicker = () => {
    if (!fileInputRef.current) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const b64 = await toBase64(file);
          setPendingImage({ base64: b64, mime: file.type || "image/jpeg" });
        } catch (_) {}
      };
      fileInputRef.current = input;
    }
    fileInputRef.current.click();
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || "";
        const commaIdx = String(result).indexOf(",");
        resolve(
          commaIdx >= 0 ? String(result).slice(commaIdx + 1) : String(result)
        );
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  return (
    <>
      <ConversationHistory
        conversation={conversation}
        isLoading={isLoading}
        error={error}
        endRef={endRef}
        onSpeak={handleSpeak}
        isSpeaking={isSpeaking}
      />
      {conversation.length === 0 && suggestions.length > 0 && (
        <Box px={4} pb={2}>
          <Text fontSize="sm" color="gray.600" mb={2}>
            Try one of these:
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2}>
            {suggestions.map((s, idx) => (
              <Button
                key={idx}
                size="sm"
                variant="outline"
                onClick={() => handleSuggestionClick(s)}
              >
                {s}
              </Button>
            ))}
          </SimpleGrid>
        </Box>
      )}
      <QuestionInput
        question={question}
        setQuestion={setQuestion}
        onSend={handleSend}
        isLoading={isLoading}
        disabled={!userId || !indexReady}
        onVoiceInput={
          browserSupportsSpeechRecognition ? toggleVoice : undefined
        }
        isListening={browserSupportsSpeechRecognition ? listening : false}
        onAttach={openFilePicker}
        hasPendingImage={!!pendingImage}
      />
    </>
  );
};

export default Chat;

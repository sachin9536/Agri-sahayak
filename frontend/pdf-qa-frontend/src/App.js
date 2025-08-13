import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";
import Profile from "./Profile";
import Welcome from "./Welcome";
import Chat from "./Chat";
import { Box, Grid, GridItem, Heading, Flex, Spacer } from "@chakra-ui/react";
import ConversationSidebar from "./ConversationSidebar";
import UserProfileBadge from "./UserProfileBadge";

const App = () => {
  const [userId, setUserId] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [indexReady, setIndexReady] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem("user_id");
    if (!existing) return;
    // Validate stored user_id against backend; if missing, clear and show welcome
    (async () => {
      try {
        await axios.get(`http://127.0.0.1:8000/users/${existing}`);
        setUserId(existing);
      } catch (e) {
        localStorage.removeItem("user_id");
        localStorage.removeItem("user_name");
        setUserId(null);
        setShowProfile(false);
      }
    })();
  }, []);

  // Health check for FAISS index readiness when userId changes
  useEffect(() => {
    if (!userId) {
      setIndexReady(false);
      return;
    }
    (async () => {
      try {
        const res = await axios.get(
          `http://127.0.0.1:8000/health/index/${userId}`
        );
        setIndexReady(!!res?.data?.ready);
      } catch (e) {
        setIndexReady(false);
      }
    })();
  }, [userId]);

  const handleProfileCreated = (id) => {
    setUserId(id);
  };

  if (!userId) {
    return (
      <Grid templateRows="64px 1fr" templateColumns="260px 1fr" minH="100vh">
        <GridItem
          as={Box}
          colSpan={2}
          bg="blue.600"
          color="white"
          px={6}
          display="flex"
          alignItems="center"
        >
          <Flex align="center" w="100%">
            <Heading size="md">Agri‑Sahayak</Heading>
            <Spacer />
            <Flex align="center" gap={3}>
              <UserProfileBadge
                name={localStorage.getItem("user_name") || "Farmer"}
              />
              {userId && (
                <Box
                  as="button"
                  onClick={async () => {
                    try {
                      await axios.post("http://127.0.0.1:8000/logout", {
                        user_id: userId,
                      });
                    } catch (_) {}
                    localStorage.removeItem("user_id");
                    localStorage.removeItem("user_name");
                    setUserId(null);
                    setSelectedConversationId(null);
                    setShowProfile(false);
                  }}
                  bg="whiteAlpha.300"
                  px={3}
                  py={1}
                  borderRadius="md"
                >
                  Logout
                </Box>
              )}
            </Flex>
          </Flex>
        </GridItem>
        <GridItem
          as={Box}
          bg="gray.50"
          borderRight="1px"
          borderColor="gray.200"
          p={4}
        >
          <ConversationSidebar
            userId={userId}
            selectedConversationId={selectedConversationId}
            onSelect={setSelectedConversationId}
          />
        </GridItem>
        <GridItem as={Box} p={0}>
          <Box p={6}>
            {showProfile ? (
              <Profile onCreated={handleProfileCreated} />
            ) : (
              <Welcome
                onRegister={() => setShowProfile(true)}
                onSignIn={(id) => setUserId(id)}
              />
            )}
          </Box>
        </GridItem>
      </Grid>
    );
  }

  return (
    <Grid templateRows="64px 1fr" templateColumns="260px 1fr" minH="100vh">
      {/* Header */}
      <GridItem
        as={Box}
        colSpan={2}
        bg="blue.600"
        color="white"
        px={6}
        display="flex"
        alignItems="center"
      >
        <Flex align="center" w="100%">
          <Heading size="md">Agri‑Sahayak</Heading>
          <Spacer />
          <Flex align="center" gap={3}>
            <UserProfileBadge
              name={localStorage.getItem("user_name") || "Farmer"}
            />
            {userId && (
              <Box
                as="button"
                onClick={async () => {
                  try {
                    await axios.post("http://127.0.0.1:8000/logout", {
                      user_id: userId,
                    });
                  } catch (_) {}
                  localStorage.removeItem("user_id");
                  localStorage.removeItem("user_name");
                  setUserId(null);
                  setSelectedConversationId(null);
                  setShowProfile(false);
                }}
                bg="whiteAlpha.300"
                px={3}
                py={1}
                borderRadius="md"
              >
                Logout
              </Box>
            )}
          </Flex>
        </Flex>
      </GridItem>

      {/* Left sidebar */}
      <GridItem
        as={Box}
        bg="gray.50"
        borderRight="1px"
        borderColor="gray.200"
        p={4}
      >
        <ConversationSidebar
          userId={userId}
          selectedConversationId={selectedConversationId}
          onSelect={setSelectedConversationId}
        />
      </GridItem>

      {/* Main content */}
      <GridItem as={Box} p={0}>
        <Box p={0} height="100%">
          <Chat
            userId={userId}
            conversationId={selectedConversationId}
            onConversationIdChange={setSelectedConversationId}
            indexReady={indexReady}
          />
        </Box>
      </GridItem>
    </Grid>
  );
};

export default App;

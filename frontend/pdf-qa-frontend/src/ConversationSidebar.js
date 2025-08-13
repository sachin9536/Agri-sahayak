import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, VStack, Text, Spinner, Button } from "@chakra-ui/react";

const ConversationSidebar = ({ userId, selectedConversationId, onSelect }) => {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const fetchConversations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `http://127.0.0.1:8000/users/${userId}/conversations`
        );
        setConversations(res?.data?.conversations || []);
      } catch (e) {
        setError("Failed to load conversations");
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, [userId]);

  return (
    <Box>
      <Text fontWeight="bold" mb={3} color="gray.700">
        Conversations
      </Text>
      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <Spinner size="sm" />
        </Box>
      )}
      {error && (
        <Box color="red.500" fontSize="sm" mb={2}>
          {error}
        </Box>
      )}
      <VStack align="stretch" spacing={2}>
        {conversations.map((c) => {
          const isActive = c.conversation_id === selectedConversationId;
          return (
            <Button
              key={c.conversation_id}
              variant={isActive ? "solid" : "ghost"}
              colorScheme={isActive ? "blue" : "gray"}
              justifyContent="flex-start"
              onClick={() => onSelect?.(c.conversation_id)}
              whiteSpace="nowrap"
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {c.title || "Untitled conversation"}
            </Button>
          );
        })}
        {conversations.length === 0 && !isLoading && (
          <Text color="gray.500" fontSize="sm">
            No conversations yet
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default ConversationSidebar;

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Heading,
  Input,
  Stack,
  Text,
  Separator,
} from "@chakra-ui/react";

const Welcome = ({ onRegister, onSignIn }) => {
  const [existingId, setExistingId] = useState("");
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    setError(null);
    try {
      const uid = existingId.trim();
      if (!uid) return;
      const res = await axios.get(`http://127.0.0.1:8000/users/${uid}`);
      const user = res?.data?.user;
      if (!user) throw new Error("Invalid user");
      localStorage.setItem("user_id", user.id);
      localStorage.setItem("user_name", user.name || "");
      onSignIn?.(user.id);
    } catch (e) {
      setError("User not found. Please check the ID or register new profile.");
    }
  };

  const handleEmailLogin = async () => {
    setError(null);
    try {
      if (!email.trim() || !password.trim()) return;
      const res = await axios.post("http://127.0.0.1:8000/login", {
        email: email.trim(),
        password: password.trim(),
      });
      const { user_id, name } = res?.data || {};
      if (!user_id) throw new Error("Invalid login response");
      localStorage.setItem("user_id", user_id);
      localStorage.setItem("user_name", name || "");
      onSignIn?.(user_id);
    } catch (e) {
      setError("Invalid email or password.");
    }
  };

  return (
    <Box>
      <Heading size="md" mb={2}>
        Welcome to Agri‑Sahayak
      </Heading>
      <Text color="gray.600" mb={6}>
        Sign in with email, or register a new profile.
      </Text>
      {error && (
        <Box color="red.500" fontSize="sm" mb={3}>
          {error}
        </Box>
      )}
      {/* Email login only for standard practice */}
      <Text fontSize="sm" color="gray.600" mb={2}>
        Sign in with email
      </Text>
      <Stack spacing={3} mb={4}>
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          bg="white"
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          bg="white"
        />
        <Button onClick={handleEmailLogin}>Sign In with Email</Button>
      </Stack>
      <Text fontSize="sm" color="gray.600" mb={2}>
        No account?
      </Text>
      <Button onClick={onRegister}>Create New Profile</Button>
    </Box>
  );
};

export default Welcome;

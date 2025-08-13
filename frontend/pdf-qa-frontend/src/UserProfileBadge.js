import React from "react";
import { Flex, Box, Text } from "@chakra-ui/react";
import { User } from "lucide-react";

const UserProfileBadge = ({ name }) => {
  const displayName = name || "Farmer";
  return (
    <Flex align="center" gap={3}>
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        w="28px"
        h="28px"
        borderRadius="full"
        bg="whiteAlpha.300"
      >
        <User size={16} />
      </Box>
      <Text fontWeight="medium">{displayName}</Text>
    </Flex>
  );
};

export default UserProfileBadge;

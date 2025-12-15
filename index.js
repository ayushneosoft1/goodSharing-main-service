import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { gateway } from "./gateway.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = "super-secret-key";

const server = new ApolloServer({
  gateway,
});

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return { user: null };
    }

    try {
      const token = authHeader.replace("Bearer ", "");
      console.log("🚀 ~ token: ====>", token);
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("🚀 ~ decoded: ====>", decoded);

      return {
        user: decoded,
        headers: {
          ...req.headers, // 👈 VERY IMPORTANT
          "x-user": JSON.stringify(decoded),
        },
      };
    } catch (err) {
      console.log("inside error ========>");
      return { user: null };
    }
  },
}).then(() => {
  console.log("Main-service running on 4000");
});

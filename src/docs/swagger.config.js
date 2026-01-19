export default {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CloudZoon API",
      version: "1.0.0",
      description: "API documentation for the CloudZoon application backend",
      contact: {
        name: "Anand Maharana",
        email: "anandmaharana427@gmail.com",
      },
    },
    servers: [
      {
        url: "http://api.local.devzoon.xyz",
        description: "Development server",
      },
      {
        url: "https://api.devzoon.xyz",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "sid",
          description: "Session ID stored in HTTP-only signed cookie",
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  apis: ["./src/docs/specs/*.yml"],
};

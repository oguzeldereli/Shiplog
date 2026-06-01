import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          900: "#0a0a0b",
          800: "#111114",
          700: "#1a1a1f",
          600: "#26262d",
          500: "#3a3a44",
          400: "#6b6b78",
          300: "#a8a8b3",
          200: "#d4d4dc",
          100: "#ececf1",
        },
        accent: {
          DEFAULT: "#7cf2b0",
          dim: "#3d8c63",
        },
      },
    },
  },
  plugins: [],
};
export default config;

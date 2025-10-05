import "@testing-library/jest-dom";

// Polyfill TextEncoder/TextDecoder for Jest (Node < 19)
import { TextEncoder, TextDecoder } from "util";

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}

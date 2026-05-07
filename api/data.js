import { jsonResponse, textResponse, loadDataAsync } from "../scripts/api-shared.mjs";

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return textResponse("Method not allowed", 405, { allow: "GET" });
    }

    return jsonResponse(await loadDataAsync());
  }
};

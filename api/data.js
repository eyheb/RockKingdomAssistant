import { jsonResponse, textResponse, loadData } from "../scripts/api-shared.mjs";

export default {
  fetch(request) {
    if (request.method !== "GET") {
      return textResponse("Method not allowed", 405, { allow: "GET" });
    }

    return jsonResponse(loadData());
  }
};

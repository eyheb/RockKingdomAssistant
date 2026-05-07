import {
  deleteCommunityEntry,
  readCommunityStore,
  saveCommunityEntry,
  saveCommunityUser
} from "../scripts/community-store.mjs";
import { jsonResponse, readJsonBody, textResponse } from "../scripts/api-shared.mjs";

export default {
  async fetch(request) {
    try {
      if (request.method === "GET") {
        return jsonResponse(await readCommunityStore());
      }

      if (request.method !== "POST") {
        return textResponse("Method not allowed", 405, { allow: "GET, POST" });
      }

      const body = await readJsonBody(request);
      if (body.action === "saveUser") {
        return jsonResponse(await saveCommunityUser(body.user));
      }
      if (body.action === "saveEntry") {
        return jsonResponse(await saveCommunityEntry(body.entry));
      }
      if (body.action === "deleteEntry") {
        return jsonResponse(await deleteCommunityEntry(body));
      }

      return jsonResponse({ error: "unknown action" }, 400);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: error.message || "internal server error" }, 500);
    }
  }
};

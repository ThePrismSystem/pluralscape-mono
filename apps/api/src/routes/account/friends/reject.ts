import { rejectFriendConnection } from "../../../services/friend-connection/transitions.js";

import { createFriendActionRoute } from "./create-friend-action-route.js";

export const rejectRoute = createFriendActionRoute("reject", rejectFriendConnection);

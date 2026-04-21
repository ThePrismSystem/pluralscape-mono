import { rejectFriendConnection } from "../../../services/account/friends/transitions.js";

import { createFriendActionRoute } from "./create-friend-action-route.js";

export const rejectRoute = createFriendActionRoute("reject", rejectFriendConnection);

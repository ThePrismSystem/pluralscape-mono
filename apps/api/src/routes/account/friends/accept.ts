import { acceptFriendConnection } from "../../../services/account/friends/transitions.js";

import { createFriendActionRoute } from "./create-friend-action-route.js";

export const acceptRoute = createFriendActionRoute("accept", acceptFriendConnection);

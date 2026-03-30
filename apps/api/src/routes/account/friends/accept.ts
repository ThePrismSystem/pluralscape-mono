import { acceptFriendConnection } from "../../../services/friend-connection.service.js";

import { createFriendActionRoute } from "./create-friend-action-route.js";

export const acceptRoute = createFriendActionRoute("accept", acceptFriendConnection);

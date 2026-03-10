export { accounts, authKeys, deviceTransferRequests, recoveryKeys, sessions } from "./auth.js";
export { members, memberPhotos } from "./members.js";
export { systems } from "./systems.js";

import type { accounts, authKeys, deviceTransferRequests, recoveryKeys, sessions } from "./auth.js";
import type { members, memberPhotos } from "./members.js";
import type { systems } from "./systems.js";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Inferred row types
export type AccountRow = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type AuthKeyRow = InferSelectModel<typeof authKeys>;
export type NewAuthKey = InferInsertModel<typeof authKeys>;
export type SessionRow = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type RecoveryKeyRow = InferSelectModel<typeof recoveryKeys>;
export type NewRecoveryKey = InferInsertModel<typeof recoveryKeys>;
export type DeviceTransferRequestRow = InferSelectModel<typeof deviceTransferRequests>;
export type NewDeviceTransferRequest = InferInsertModel<typeof deviceTransferRequests>;
export type SystemRow = InferSelectModel<typeof systems>;
export type NewSystem = InferInsertModel<typeof systems>;
export type MemberRow = InferSelectModel<typeof members>;
export type NewMember = InferInsertModel<typeof members>;
export type MemberPhotoRow = InferSelectModel<typeof memberPhotos>;
export type NewMemberPhoto = InferInsertModel<typeof memberPhotos>;

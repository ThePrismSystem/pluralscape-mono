import {
  RemovePinBodySchema,
  SetPinBodySchema,
  SetupCompleteBodySchema,
  SetupNomenclatureStepBodySchema,
  SetupProfileStepBodySchema,
  UpdateNomenclatureBodySchema,
  UpdateSystemSettingsBodySchema,
  VerifyPinBodySchema,
} from "@pluralscape/validation";

import {
  getNomenclatureSettings,
  updateNomenclatureSettings,
} from "../../services/nomenclature.service.js";
import { removePin, setPin, verifyPinCode } from "../../services/pin.service.js";
import {
  setupComplete,
  setupNomenclatureStep,
  setupProfileStep,
  getSetupStatus,
} from "../../services/setup.service.js";
import { getSystemSettings, updateSystemSettings } from "../../services/system-settings.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");
const authHeavyLimiter = createTRPCCategoryRateLimiter("authHeavy");

export const systemSettingsRouter = router({
  settings: router({
    get: systemProcedure.use(readLimiter).query(async ({ ctx }) => {
      return getSystemSettings(ctx.db, ctx.systemId, ctx.auth);
    }),
    update: systemProcedure
      .use(writeLimiter)
      .input(UpdateSystemSettingsBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return updateSystemSettings(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
  }),
  nomenclature: router({
    get: systemProcedure.use(readLimiter).query(async ({ ctx }) => {
      return getNomenclatureSettings(ctx.db, ctx.systemId, ctx.auth);
    }),
    update: systemProcedure
      .use(writeLimiter)
      .input(UpdateNomenclatureBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return updateNomenclatureSettings(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
  }),
  pin: router({
    set: systemProcedure
      .use(authHeavyLimiter)
      .input(SetPinBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await setPin(ctx.db, ctx.systemId, input, ctx.auth, audit);
        return { success: true as const };
      }),
    remove: systemProcedure
      .use(authHeavyLimiter)
      .input(RemovePinBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await removePin(ctx.db, ctx.systemId, input, ctx.auth, audit);
        return { success: true as const };
      }),
    verify: systemProcedure
      .use(authHeavyLimiter)
      .input(VerifyPinBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return verifyPinCode(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
  }),
  setup: router({
    getStatus: systemProcedure.use(readLimiter).query(async ({ ctx }) => {
      return getSetupStatus(ctx.db, ctx.systemId, ctx.auth);
    }),
    nomenclatureStep: systemProcedure
      .use(writeLimiter)
      .input(SetupNomenclatureStepBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return setupNomenclatureStep(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
    profileStep: systemProcedure
      .use(writeLimiter)
      .input(SetupProfileStepBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return setupProfileStep(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
    complete: systemProcedure
      .use(writeLimiter)
      .input(SetupCompleteBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return setupComplete(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
  }),
});

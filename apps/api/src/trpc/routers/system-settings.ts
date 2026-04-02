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
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

export const systemSettingsRouter = router({
  getSettings: systemProcedure.query(async ({ ctx }) => {
    return getSystemSettings(ctx.db, ctx.systemId, ctx.auth);
  }),

  updateSettings: systemProcedure
    .input(UpdateSystemSettingsBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateSystemSettings(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  getNomenclature: systemProcedure.query(async ({ ctx }) => {
    return getNomenclatureSettings(ctx.db, ctx.systemId, ctx.auth);
  }),

  updateNomenclature: systemProcedure
    .input(UpdateNomenclatureBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateNomenclatureSettings(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  setPin: systemProcedure.input(SetPinBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await setPin(ctx.db, ctx.systemId, input, ctx.auth, audit);
    return { success: true as const };
  }),

  removePin: systemProcedure.input(RemovePinBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await removePin(ctx.db, ctx.systemId, input, ctx.auth, audit);
    return { success: true as const };
  }),

  verifyPin: systemProcedure.input(VerifyPinBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return verifyPinCode(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  getSetupStatus: systemProcedure.query(async ({ ctx }) => {
    return getSetupStatus(ctx.db, ctx.systemId, ctx.auth);
  }),

  setupNomenclatureStep: systemProcedure
    .input(SetupNomenclatureStepBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return setupNomenclatureStep(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  setupProfileStep: systemProcedure
    .input(SetupProfileStepBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return setupProfileStep(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  setupComplete: systemProcedure.input(SetupCompleteBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return setupComplete(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),
});

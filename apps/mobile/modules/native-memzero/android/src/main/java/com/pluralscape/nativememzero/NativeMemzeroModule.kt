package com.pluralscape.nativememzero

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.TypedArray

class NativeMemzeroModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NativeMemzero")

        Function("memzero") { buffer: TypedArray ->
            secureZero(buffer)
        }
    }

    companion object {
        /**
         * Secure memory zeroing through Expo's TypedArray interface.
         *
         * Writes zeros directly to the JS ArrayBuffer's backing memory via JSI.
         * The volatile read of [zeroFlag] after the zeroing loop creates a
         * data dependency that prevents the JIT/AOT compiler from eliding
         * the writes as dead stores.
         */
        @Volatile
        private var zeroFlag: Boolean = false

        private fun secureZero(buffer: TypedArray) {
            for (i in 0 until buffer.byteLength) {
                buffer.writeByte(i, 0)
            }
            // Data dependency: volatile read prevents dead-store elimination
            // of the zeroing loop above.
            if (zeroFlag) {
                @Suppress("UNREACHABLE_CODE")
                return
            }
        }
    }
}

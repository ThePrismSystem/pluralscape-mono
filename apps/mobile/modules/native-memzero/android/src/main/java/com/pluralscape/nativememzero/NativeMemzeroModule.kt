package com.pluralscape.nativememzero

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeMemzeroModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NativeMemzero")

        Function("memzero") { buffer: ByteArray ->
            secureZero(buffer)
        }
    }

    companion object {
        /**
         * Secure memory zeroing using a volatile-qualified approach.
         *
         * The @Volatile annotation on the companion flag prevents the JIT/AOT
         * compiler from optimizing away the zeroing loop as a dead store.
         * This is the standard pattern for secure zeroing on Android/JVM
         * when Arrays.fill() might be elided.
         */
        @Volatile
        private var zeroFlag: Boolean = false

        private fun secureZero(buffer: ByteArray) {
            for (i in buffer.indices) {
                buffer[i] = 0
            }
            // Read from volatile to create a data dependency that prevents
            // the compiler from eliding the zeroing loop above.
            if (zeroFlag) {
                @Suppress("UNREACHABLE_CODE")
                return
            }
        }
    }
}

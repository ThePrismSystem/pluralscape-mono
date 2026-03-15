import ExpoModulesCore

public class NativeMemzeroModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeMemzero")

        Function("memzero") { (buffer: TypedArray) in
            buffer.withUnsafeMutableRawBufferPointer { ptr in
                guard let baseAddress = ptr.baseAddress else { return }
                // memset_s (C11 Annex K) is guaranteed not to be optimized away,
                // unlike memset which compilers may elide as a dead store.
                _ = memset_s(baseAddress, ptr.count, 0, ptr.count)
            }
        }
    }
}

export function connect() {
  const 应答 = Uint8Array.of(0x16, 0x03, 0x03, 0x00, 0x02, 0x02, 0x00);
  return {
    opened: Promise.resolve(),
    close() {},
    writable: {
      getWriter() {
        return {
          write() {
            return Promise.resolve();
          },
          releaseLock() {}
        };
      }
    },
    readable: {
      getReader() {
        let 已读 = false;
        return {
          read() {
            if (已读) return Promise.resolve({ done: true, value: undefined });
            已读 = true;
            return Promise.resolve({ done: false, value: 应答 });
          },
          releaseLock() {}
        };
      }
    }
  };
}

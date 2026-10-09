export function connect() {
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
    }
  };
}

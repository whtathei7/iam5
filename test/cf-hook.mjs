export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:sockets') {
    return {
      shortCircuit: true,
      url: new URL('./cf-sockets-mock.mjs', import.meta.url).href
    };
  }
  return nextResolve(specifier, context);
}

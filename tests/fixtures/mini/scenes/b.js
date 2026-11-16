// fixture scene (rendered only by the mock renderer in tests)
export async function build() { return { renderer: { domElement: null }, render() {} }; }

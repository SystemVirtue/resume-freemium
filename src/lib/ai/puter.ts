declare global {
  interface Window {
    puter?: any;
  }
}

let loading: Promise<any> | null = null;

export function loadPuter(): Promise<any> {
  if (window.puter) return Promise.resolve(window.puter);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    script.onload = () => {
      if (window.puter) resolve(window.puter);
      else reject(new Error('Puter failed to load.'));
    };
    script.onerror = () => reject(new Error('Could not reach puter.com.'));
    document.head.appendChild(script);
  });

  return loading;
}

export async function isPuterSignedIn(): Promise<boolean> {
  try {
    const puter = await loadPuter();
    return Boolean(puter?.auth?.isSignedIn?.());
  } catch {
    return false;
  }
}

export async function puterSignIn(): Promise<boolean> {
  const puter = await loadPuter();
  if (puter.auth.isSignedIn()) return true;
  await puter.auth.signIn();
  return puter.auth.isSignedIn();
}

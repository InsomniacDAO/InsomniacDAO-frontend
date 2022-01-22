import SleepImg from "../assets/tokens/SLEEP.png";
import SSleepImg from "../assets/tokens/REST.png";

function toUrl(tokenPath: string): string {
  const host = window.location.origin;
  return `${host}/${tokenPath}`;
}

export function getTokenUrl(name: string) {
  if (name === "sleep") {
    return toUrl(SleepImg);
  }

  if (name === "sleep") {
    return toUrl(SSleepImg);
  }

  throw Error(`Token url doesn't support: ${name}`);
}

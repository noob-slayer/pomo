// TODO: swap in the real Buy Me a Coffee username once you have one
const COFFEE_URL = "https://www.buymeacoffee.com/sidcodes";

export function Credit() {
  return (
    <div className="credit">
      <span>vibe coded by Sid with &lt;3</span>
      <a className="credit__coffee" href={COFFEE_URL} target="_blank" rel="noreferrer">
        buy me a coffee
      </a>
    </div>
  );
}

/** Original editorial illustration. It does not represent a listing or a map. */
export function DiscoveryAtlas() {
  return (
    <figure className="discovery-atlas">
      <div className="atlas-heading"><span>MORADA / ATLAS DE POSSIBILIDADES</span><span aria-hidden="true">↗</span></div>
      <svg viewBox="0 0 560 430" role="img" aria-label="Ilustração conceitual: diferentes caminhos se encontram em uma casa">
        <defs>
          <pattern id="atlas-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#c4c0b2" strokeWidth="0.6" /></pattern>
          <pattern id="atlas-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#9aab9b" strokeWidth="1" /></pattern>
        </defs>
        <rect width="560" height="430" fill="url(#atlas-grid)" />
        <circle cx="285" cy="206" r="174" fill="none" stroke="#a3aa9b" strokeDasharray="3 7" />
        <path d="M0 316H94V206H167M560 91H460V206H393M276 430V329" fill="none" stroke="#b34a32" strokeWidth="2" strokeDasharray="5 6" />
        <path d="M150 117L323 65L438 130L266 185Z" fill="#d3d8c6" stroke="#34483e" />
        <path d="M150 117L266 185V323L150 253Z" fill="#bcc9b4" stroke="#34483e" />
        <path d="M266 185L438 130V268L266 323Z" fill="#eae3d1" stroke="#34483e" />
        <path d="M150 117L323 65L438 130L266 185Z" fill="url(#atlas-hatch)" />
        <path d="M203 101L277 79L384 143L310 166Z" fill="#f6f1e5" stroke="#34483e" />
        <path d="M310 166V111L277 79V146" fill="#f6f1e5" stroke="#34483e" />
        <path d="M175 156L225 186V238L175 207Z" fill="#506b5a" stroke="#34483e" />
        <path d="M200 171V223M175 181L225 211" stroke="#d7ddca" />
        <path d="M297 203L366 181V235L297 257Z" fill="#a3b49b" stroke="#34483e" />
        <path d="M332 192V246M297 230L366 208" stroke="#34483e" />
        <path d="M389 203L418 194V274L389 284Z" fill="#b34a32" stroke="#34483e" />
        <path d="M132 273L266 351L460 288M266 351V372" fill="none" stroke="#34483e" />
        <circle cx="94" cy="316" r="7" fill="#b34a32" /><circle cx="460" cy="91" r="7" fill="#b34a32" /><circle cx="276" cy="391" r="7" fill="#b34a32" />
        <path d="M71 86V42L61 60M71 42L81 60" fill="none" stroke="#34483e" />
        <text x="64" y="110" fontSize="12" fill="#34483e">N</text>
      </svg>
      <figcaption><span>Diferentes caminhos.<br /><strong>O seu lugar no centro.</strong></span><small>ILUSTRAÇÃO CONCEITUAL<br />NÃO REPRESENTA UM ANÚNCIO</small></figcaption>
    </figure>
  );
}

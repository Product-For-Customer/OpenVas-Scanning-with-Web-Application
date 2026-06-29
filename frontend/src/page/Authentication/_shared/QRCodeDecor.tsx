import React from "react";

const QRCodeDecor: React.FC = () => (
  <div className="bg-white p-3 inline-block border border-gray-100">
    <svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="150" height="150" fill="white" />
      {/* TL finder */}
      <rect x="8"  y="8"  width="44" height="44" fill="black" />
      <rect x="14" y="14" width="32" height="32" fill="white" />
      <rect x="20" y="20" width="20" height="20" fill="black" />
      {/* TR finder */}
      <rect x="98" y="8"  width="44" height="44" fill="black" />
      <rect x="104" y="14" width="32" height="32" fill="white" />
      <rect x="110" y="20" width="20" height="20" fill="black" />
      {/* BL finder */}
      <rect x="8"  y="98" width="44" height="44" fill="black" />
      <rect x="14" y="104" width="32" height="32" fill="white" />
      <rect x="20" y="110" width="20" height="20" fill="black" />
      {/* Data modules */}
      <rect x="62" y="8"  width="7" height="7" fill="black" />
      <rect x="77" y="8"  width="7" height="7" fill="black" />
      <rect x="62" y="23" width="7" height="7" fill="black" />
      <rect x="70" y="23" width="7" height="7" fill="black" />
      <rect x="85" y="23" width="7" height="7" fill="black" />
      <rect x="62" y="38" width="7" height="7" fill="black" />
      <rect x="77" y="38" width="7" height="7" fill="black" />
      <rect x="62" y="53" width="7" height="7" fill="black" />
      <rect x="77" y="53" width="7" height="7" fill="black" />
      <rect x="85" y="53" width="7" height="7" fill="black" />
      <rect x="8"  y="62" width="7" height="7" fill="black" />
      <rect x="23" y="62" width="7" height="7" fill="black" />
      <rect x="38" y="62" width="7" height="7" fill="black" />
      <rect x="62" y="62" width="7" height="7" fill="black" />
      <rect x="70" y="62" width="7" height="7" fill="black" />
      <rect x="85" y="62" width="7" height="7" fill="black" />
      <rect x="98" y="62" width="7" height="7" fill="black" />
      <rect x="113" y="62" width="7" height="7" fill="black" />
      <rect x="128" y="62" width="7" height="7" fill="black" />
      <rect x="135" y="62" width="7" height="7" fill="black" />
      <rect x="8"  y="70" width="7" height="7" fill="black" />
      <rect x="38" y="70" width="7" height="7" fill="black" />
      <rect x="62" y="70" width="7" height="7" fill="black" />
      <rect x="85" y="70" width="7" height="7" fill="black" />
      <rect x="98" y="70" width="7" height="7" fill="black" />
      <rect x="120" y="70" width="7" height="7" fill="black" />
      <rect x="8"  y="77" width="7" height="7" fill="black" />
      <rect x="16" y="77" width="7" height="7" fill="black" />
      <rect x="23" y="77" width="7" height="7" fill="black" />
      <rect x="31" y="77" width="7" height="7" fill="black" />
      <rect x="38" y="77" width="7" height="7" fill="black" />
      <rect x="62" y="77" width="7" height="7" fill="black" />
      <rect x="77" y="77" width="7" height="7" fill="black" />
      <rect x="91" y="77" width="7" height="7" fill="black" />
      <rect x="98" y="77" width="7" height="7" fill="black" />
      <rect x="113" y="77" width="7" height="7" fill="black" />
      <rect x="128" y="77" width="7" height="7" fill="black" />
      <rect x="135" y="77" width="7" height="7" fill="black" />
      <rect x="62" y="85" width="7" height="7" fill="black" />
      <rect x="77" y="85" width="7" height="7" fill="black" />
      <rect x="91" y="85" width="7" height="7" fill="black" />
      <rect x="113" y="85" width="7" height="7" fill="black" />
      <rect x="135" y="85" width="7" height="7" fill="black" />
      <rect x="62" y="98" width="7" height="7" fill="black" />
      <rect x="70" y="98" width="7" height="7" fill="black" />
      <rect x="77" y="98" width="7" height="7" fill="black" />
      <rect x="91" y="98" width="7" height="7" fill="black" />
      <rect x="98" y="98" width="7" height="7" fill="black" />
      <rect x="113" y="98" width="7" height="7" fill="black" />
      <rect x="128" y="98" width="7" height="7" fill="black" />
      <rect x="62" y="113" width="7" height="7" fill="black" />
      <rect x="77" y="113" width="7" height="7" fill="black" />
      <rect x="98" y="113" width="7" height="7" fill="black" />
      <rect x="113" y="113" width="7" height="7" fill="black" />
      <rect x="62" y="120" width="7" height="7" fill="black" />
      <rect x="70" y="120" width="7" height="7" fill="black" />
      <rect x="85" y="120" width="7" height="7" fill="black" />
      <rect x="98" y="120" width="7" height="7" fill="black" />
      <rect x="120" y="120" width="7" height="7" fill="black" />
      <rect x="135" y="120" width="7" height="7" fill="black" />
      <rect x="62" y="135" width="7" height="7" fill="black" />
      <rect x="70" y="135" width="7" height="7" fill="black" />
      <rect x="77" y="135" width="7" height="7" fill="black" />
      <rect x="91" y="135" width="7" height="7" fill="black" />
      <rect x="98" y="135" width="7" height="7" fill="black" />
      <rect x="120" y="135" width="7" height="7" fill="black" />
    </svg>
  </div>
);

export default QRCodeDecor;

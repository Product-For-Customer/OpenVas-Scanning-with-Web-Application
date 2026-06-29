import React from "react";
import { FaFacebook, FaGoogle, FaTwitter } from "react-icons/fa";

const SocialButtons: React.FC = () => (
  <div className="flex gap-3 justify-center">
    <button
      type="button"
      className="flex items-center gap-2 border border-blue-600 px-5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition"
    >
      <FaFacebook className="text-blue-600 text-base shrink-0" />
      Facebook
    </button>
    <button
      type="button"
      className="flex items-center gap-2 border border-red-500 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
    >
      <FaGoogle className="text-red-500 text-base shrink-0" />
      Google
    </button>
    <button
      type="button"
      className="flex items-center gap-2 border border-blue-400 px-5 py-2 text-sm font-semibold text-blue-500 hover:bg-blue-50 transition"
    >
      <FaTwitter className="text-blue-400 text-base shrink-0" />
      twitter
    </button>
  </div>
);

export default SocialButtons;

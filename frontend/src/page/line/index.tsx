import React from "react";
import HistoryNotify from "./history";
import Notify from "./notify";
import Graph from "./graph";
import Count from "./count";

const Index: React.FC = () => {
  return (
    <div className="w-full">
      {/* Row 1: Notify full width */}
      <div className="mb-4">
        <Notify />
      </div>

      {/* Row 2: Count / Graph */}
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-10">
        <div className="xl:col-span-6 h-full">
          <Count />
        </div>

        <div className="xl:col-span-4 h-full">
          <Graph />
        </div>
      </div>

      {/* Row 3: History full width */}
      <div>
        <HistoryNotify />
      </div>
    </div>
  );
};

export default Index;
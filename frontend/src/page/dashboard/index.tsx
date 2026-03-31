import React from "react";
import Value from "./Value";
import AverageEnrollment from "./Average/index";
import TopPerforming from "./Top/index";
import BarSeverityChart from "./Analysis/index";
import TopVulnerability from "./Vulnerbility/index";

const DashboardIndex: React.FC = () => {
  return (
    <div className="w-full">
      <div className="mb-4 sm:mb-5">
        <Value />
      </div>

      {/* AverageEnrollment เต็มแถว */}
      <div className="mb-4 sm:mb-5">
        <AverageEnrollment />
      </div>

      {/* Middle section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 mb-4 sm:mb-5 items-stretch">
        <div className="xl:col-span-4 h-full">
          <TopVulnerability />
        </div>

        <div className="xl:col-span-4 h-full">
          <BarSeverityChart />
        </div>

        <div className="xl:col-span-4 h-full">
          <TopPerforming />
        </div>
      </div>
    </div>
  );
};

export default DashboardIndex;
import React from "react";
import Value from "./Value";
import AverageEnrollment from "./Average/index";
import TopPerforming from "./Top/index";
import DeliveryAnalysis from "./Analysis/index";
import TopVulnerability from "./Vulnerbility/index";

const DashboardIndex: React.FC = () => {
  return (
    <div className="w-full overflow-visible">
      <div className="relative z-60 mb-4 sm:mb-5">
        <Value />
      </div>

      <div className="relative z-10 mb-4 sm:mb-5">
        <AverageEnrollment />
      </div>

      <div className="relative z-0 mb-4 grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12 xl:auto-rows-fr xl:items-stretch">
        <div className="xl:col-span-4 flex w-full h-full min-h-0">
          <TopVulnerability />
        </div>

        <div className="xl:col-span-4 flex w-full h-full min-h-0">
          <DeliveryAnalysis />
        </div>

        <div className="xl:col-span-4 flex w-full h-full min-h-0">
          <TopPerforming />
        </div>
      </div>
    </div>
  );
};

export default DashboardIndex;
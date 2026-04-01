import React from "react";
import Value from "./Value";
import AverageEnrollment from "./Average/index";
import TopPerforming from "./Top/index";
import DeliveryAnalysis from "./Analysis/index";
import TopVulnerability from "./Vulnerbility/index";

const DashboardIndex: React.FC = () => {
  return (
    <div className="w-full">
      <div className="mb-4 sm:mb-5">
        <Value />
      </div>

      <div className="mb-4 sm:mb-5">
        <AverageEnrollment />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 xl:auto-rows-fr gap-4 sm:gap-5 mb-4 sm:mb-5 items-stretch">
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
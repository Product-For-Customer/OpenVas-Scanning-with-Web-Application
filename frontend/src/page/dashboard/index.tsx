import React, { useEffect, useRef, useState } from "react";
import Value from "./Value";
import AverageEnrollment from "./Average/index";
import TopPerforming from "./Top/index";
import DeliveryAnalysis from "./Analysis/index";
import TopVulnerability from "./Vulnerbility/index";
import {
  ListVulnerability,
  type VulnerabilityLevelDTO,
} from "../../services";

const DashboardIndex: React.FC = () => {
  const [vulnerabilityData, setVulnerabilityData] = useState<
    VulnerabilityLevelDTO[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchData = async () => {
      if (isFetchingRef.current) return;

      try {
        isFetchingRef.current = true;

        if (isMountedRef.current) {
          setLoading(true);
        }

        const res = await ListVulnerability();

        if (!isMountedRef.current) return;

        setVulnerabilityData(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("Failed to load vulnerability data:", error);

        if (!isMountedRef.current) return;

        setVulnerabilityData([]);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    };

    void fetchData();
  }, []);

  return (
    <div className="relative isolate z-0 w-full overflow-visible">
      <div className="relative z-20 mb-4 sm:mb-5">
        <Value vulnerabilityData={vulnerabilityData} loading={loading} />
      </div>

      <div className="relative z-0 mb-4 sm:mb-5">
        <AverageEnrollment />
      </div>

      <div className="relative z-0 mb-4 grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12 xl:auto-rows-fr xl:items-stretch">
        <div className="flex h-full min-h-0 w-full xl:col-span-4">
          <TopVulnerability
            vulnerabilityData={vulnerabilityData}
            loading={loading}
          />
        </div>

        <div className="flex h-full min-h-0 w-full xl:col-span-4">
          <DeliveryAnalysis
            vulnerabilityData={vulnerabilityData}
            loading={loading}
          />
        </div>

        <div className="flex h-full min-h-0 w-full xl:col-span-4">
          <TopPerforming />
        </div>
      </div>
    </div>
  );
};

export default DashboardIndex;
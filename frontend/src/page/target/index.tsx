import React, { useEffect, useRef, useState } from "react";
import StatusTarget from "./Status/index";
import RiskScoreGraph from "./RiskScoreGraph";
import RiskScoreTable from "./RiskScoreTable";
import TableTarget from "./TableTarget";
import DeviceMap from "./Map";
import { ListDeviceRisk, type DeviceRiskDTO } from "../../services";

const Target: React.FC = () => {
  const [deviceRisks, setDeviceRisks] = useState<DeviceRiskDTO[]>([]);
  const [loadingDeviceRisks, setLoadingDeviceRisks] = useState<boolean>(true);

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

    const fetchDeviceRisks = async () => {
      if (isFetchingRef.current) return;

      try {
        isFetchingRef.current = true;

        if (isMountedRef.current) {
          setLoadingDeviceRisks(true);
        }

        const res = await ListDeviceRisk();

        if (!isMountedRef.current) return;

        setDeviceRisks(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("ListDeviceRisk error in Target:", error);

        if (!isMountedRef.current) return;

        setDeviceRisks([]);
      } finally {
        if (isMountedRef.current) {
          setLoadingDeviceRisks(false);
        }
        isFetchingRef.current = false;
      }
    };

    void fetchDeviceRisks();
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4 sm:mb-5">
        <StatusTarget />
      </div>

      <div className="mb-4 sm:mb-5">
        <DeviceMap />
      </div>

      <div className="mb-4 grid grid-cols-1 items-stretch gap-4 sm:mb-5 sm:gap-5 xl:grid-cols-12">
        <div className="h-full xl:col-span-7">
          <RiskScoreGraph />
        </div>

        <div className="h-full xl:col-span-5">
          <RiskScoreTable data={deviceRisks} loading={loadingDeviceRisks} />
        </div>
      </div>

      <div className="mb-2">
        <TableTarget data={deviceRisks} loading={loadingDeviceRisks} />
      </div>
    </div>
  );
};

export default Target;
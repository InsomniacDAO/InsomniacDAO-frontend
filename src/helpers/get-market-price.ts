import { ethers } from "ethers";
import { LpReserveContract } from "../abi";
import { mimSleep } from "../helpers/bond";
import { Networks } from "../constants/blockchain";

export async function getMarketPrice(
  networkID: Networks,
  provider: ethers.Signer | ethers.providers.Provider,
): Promise<number> {
  const mimSleepAddress = mimSleep.getAddressForReserve(networkID);
  const pairContract = new ethers.Contract(mimSleepAddress, LpReserveContract, provider);
  const reserves = await pairContract.getReserves();
  const marketPrice = reserves[0] / reserves[1];
  return marketPrice;
}

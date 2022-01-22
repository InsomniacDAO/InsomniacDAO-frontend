import { ethers } from "ethers";
import { RestContract } from "../abi";
import { Networks } from "../constants/blockchain";
import { getAddresses } from "src/constants/addresses";

export async function getBalanceForGons(
  gons: number,
  networkID: Networks,
  provider: ethers.Signer | ethers.providers.Provider,
): Promise<number> {
  const addresses = getAddresses(networkID);
  const restContract = new ethers.Contract(addresses.SRUG_ADDRESS, RestContract, provider);
  const balanceWithRebases = await restContract.balanceForGons(gons);
  return balanceWithRebases;
}

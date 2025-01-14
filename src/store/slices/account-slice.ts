import { ethers } from "ethers";
import { getAddresses } from "../../constants";
import { SleepTokenContract, RestContract, MimTokenContract, StakingContract } from "../../abi";
import { getBalanceForGons, setAll } from "../../helpers";

import { createSlice, createSelector, createAsyncThunk } from "@reduxjs/toolkit";
import { JsonRpcProvider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { Bond } from "../../helpers/bond/bond";
import { Networks } from "../../constants/blockchain";
import React from "react";
import { RootState } from "../store";
import { IToken } from "../../helpers/tokens";
import { NumberLiteralType } from "typescript";

interface IGetBalances {
  address: string;
  networkID: Networks;
  provider: StaticJsonRpcProvider | JsonRpcProvider;
}

interface IAccountBalances {
  balances: {
    sleep: string;
    rest: string;
  };
}

export const getBalances = createAsyncThunk(
  "account/getBalances",
  async ({ address, networkID, provider }: IGetBalances): Promise<IAccountBalances> => {
    const addresses = getAddresses(networkID);

    const memoContract = new ethers.Contract(addresses.SRUG_ADDRESS, RestContract, provider);
    const memoBalance = await memoContract.balanceOf(address);
    const timeContract = new ethers.Contract(addresses.RUG_ADDRESS, SleepTokenContract, provider);
    const timeBalance = await timeContract.balanceOf(address);

    return {
      balances: {
        rest: ethers.utils.formatUnits(memoBalance, "gwei"),
        sleep: ethers.utils.formatUnits(timeBalance, "gwei"),
      },
    };
  },
);

interface IWarmUpInfo {
  warmupInfo: {
    expiry: number;
    deposit: string;
    epoch: number;
    gons: string;
    gonsBalance: string;
  };
}


interface ILoadAccountDetails {
  address: string;
  networkID: Networks;
  provider: StaticJsonRpcProvider | JsonRpcProvider;
}

export const loadWarmUpInfo = createAsyncThunk(
  "account/loadWarmUpInfo",
  async ({ networkID, provider, address }: ILoadAccountDetails): Promise<IWarmUpInfo> => {
    const addresses = getAddresses(networkID);

    const stakingContract = new ethers.Contract(addresses.STAKING_ADDRESS, StakingContract, provider);
    const warmupDetails = await stakingContract.warmupInfo(address);
    const depositBalance = warmupDetails.deposit;
    const warmupExpiry = warmupDetails.expiry;
    const epochDetails = await stakingContract.epoch();
    const currentEpoch = epochDetails.number;

    const gons = warmupDetails.gons;
    const gonsBalance = await getBalanceForGons(gons, networkID, provider);

    return {
      warmupInfo: {
        expiry: warmupExpiry,
        deposit: ethers.utils.formatUnits(depositBalance, "gwei"),
        epoch: currentEpoch,
        gons: gons,
        gonsBalance: ethers.utils.formatUnits(gonsBalance, "gwei"),
      },
    };
  },
);

interface IUserAccountDetails {
  balances: {
    sleep: string;
    rest: string;
  };
  staking: {
    sleep: number;
    rest: number;
  };
}

export const loadAccountDetails = createAsyncThunk(
  "account/loadAccountDetails",
  async ({ networkID, provider, address }: ILoadAccountDetails): Promise<IUserAccountDetails> => {
    let timeBalance = 0;
    let memoBalance = 0;
    let stakeAllowance = 0;
    let unstakeAllowance = 0;

    const addresses = getAddresses(networkID);

    if (addresses.RUG_ADDRESS) {
      const timeContract = new ethers.Contract(addresses.RUG_ADDRESS, SleepTokenContract, provider);
      timeBalance = await timeContract.balanceOf(address);
      stakeAllowance = await timeContract.allowance(address, addresses.STAKING_HELPER_ADDRESS);
    }

    if (addresses.SRUG_ADDRESS) {
      const memoContract = new ethers.Contract(addresses.SRUG_ADDRESS, RestContract, provider);
      memoBalance = await memoContract.balanceOf(address);
      unstakeAllowance = await memoContract.allowance(address, addresses.STAKING_ADDRESS);
    }

    return {
      balances: {
        sleep: ethers.utils.formatUnits(memoBalance, "gwei"),
        rest: ethers.utils.formatUnits(timeBalance, "gwei"),
      },
      staking: {
        sleep: Number(stakeAllowance),
        rest: Number(unstakeAllowance),
      },
    };
  },
);

interface ICalcUserBondDetails {
  address: string;
  bond: Bond;
  provider: StaticJsonRpcProvider | JsonRpcProvider;
  networkID: Networks;
}

export interface IUserBondDetails {
  allowance: number;
  balance: number;
  avaxBalance: number;
  interestDue: number;
  bondMaturationBlock: number;
  pendingPayout: number; //Payout formatted in gwei.
}

export const calculateUserBondDetails = createAsyncThunk(
  "account/calculateUserBondDetails",
  async ({ address, bond, networkID, provider }: ICalcUserBondDetails) => {
    if (!address) {
      return new Promise<any>(resevle => {
        resevle({
          bond: "",
          displayName: "",
          bondIconSvg: "",
          isLP: false,
          allowance: 0,
          balance: 0,
          interestDue: 0,
          bondMaturationBlock: 0,
          pendingPayout: "",
          avaxBalance: 0,
        });
      });
    }

    const bondContract = bond.getContractForBond(networkID, provider);
    const reserveContract = bond.getContractForReserve(networkID, provider);

    let interestDue, pendingPayout, bondMaturationBlock;

    const bondDetails = await bondContract.bondInfo(address);
    interestDue = bondDetails.payout / Math.pow(10, 9);
    bondMaturationBlock = Number(bondDetails.vesting) + Number(bondDetails.lastTime);
    pendingPayout = await bondContract.pendingPayoutFor(address);

    let allowance,
      balance = "0";

    allowance = await reserveContract.allowance(address, bond.getAddressForBond(networkID));
    balance = await reserveContract.balanceOf(address);
    const tokenDecimal = await reserveContract.decimals();
    const balanceVal = Number(balance) / Math.pow(10, tokenDecimal);

    const avaxBalance = await provider.getSigner().getBalance();
    const avaxVal = ethers.utils.formatEther(avaxBalance);

    const pendingPayoutVal = ethers.utils.formatUnits(pendingPayout, "gwei");

    return {
      bond: bond.name,
      displayName: bond.displayName,
      bondIconSvg: bond.bondIconSvg,
      isLP: bond.isLP,
      allowance: Number(allowance),
      balance: Number(balanceVal),
      avaxBalance: Number(avaxVal),
      interestDue,
      bondMaturationBlock,
      pendingPayout: Number(pendingPayoutVal),
    };
  },
);

interface ICalcUserTokenDetails {
  address: string;
  token: IToken;
  provider: StaticJsonRpcProvider | JsonRpcProvider;
  networkID: Networks;
}

export interface IUserTokenDetails {
  allowance: number;
  balance: number;
  isAvax?: boolean;
}

export const calculateUserTokenDetails = createAsyncThunk(
  "account/calculateUserTokenDetails",
  async ({ address, token, networkID, provider }: ICalcUserTokenDetails) => {
    if (!address) {
      return new Promise<any>(resevle => {
        resevle({
          token: "",
          address: "",
          img: "",
          allowance: 0,
          balance: 0,
        });
      });
    }

    if (token.isAvax) {
      const avaxBalance = await provider.getSigner().getBalance();
      const avaxVal = ethers.utils.formatEther(avaxBalance);

      return {
        token: token.name,
        tokenIcon: token.img,
        balance: Number(avaxVal),
        isAvax: true,
      };
    }

    const addresses = getAddresses(networkID);

    const tokenContract = new ethers.Contract(token.address, MimTokenContract, provider);

    let allowance,
      balance = "0";

    allowance = await tokenContract.allowance(address, addresses.ZAPIN_ADDRESS);
    balance = await tokenContract.balanceOf(address);

    const balanceVal = Number(balance) / Math.pow(10, token.decimals);

    return {
      token: token.name,
      address: token.address,
      img: token.img,
      allowance: Number(allowance),
      balance: Number(balanceVal),
    };
  },
);

export interface IAccountSlice {
  bonds: { [key: string]: IUserBondDetails };
  balances: {
    sleep: string;
    rest: string;
  };
  loading: boolean;
  staking: {
    sleep: number;
    rest: number;
  };
  warmupInfo: {
    expiry: string;
    deposit: string;
    epoch: string;
    gons: string;
    gonsBalance: string;
  };
  tokens: { [key: string]: IUserTokenDetails };
}

const initialState: IAccountSlice = {
  loading: true,
  bonds: {},
  balances: { sleep: "", rest: "" },
  staking: { sleep: 0, rest: 0 },
  warmupInfo: { expiry: "", deposit: "", epoch: "", gons: "", gonsBalance: "" },
  tokens: {},
};

const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    fetchAccountSuccess(state, action) {
      setAll(state, action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadWarmUpInfo.pending, state => {
        state.loading = true;
      })
      .addCase(loadWarmUpInfo.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(loadWarmUpInfo.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(loadAccountDetails.pending, state => {
        state.loading = true;
      })
      .addCase(loadAccountDetails.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(loadAccountDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(getBalances.pending, state => {
        state.loading = true;
      })
      .addCase(getBalances.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(getBalances.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(calculateUserBondDetails.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(calculateUserBondDetails.fulfilled, (state, action) => {
        if (!action.payload) return;
        const bond = action.payload.bond;
        state.bonds[bond] = action.payload;
        state.loading = false;
      })
      .addCase(calculateUserBondDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(calculateUserTokenDetails.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(calculateUserTokenDetails.fulfilled, (state, action) => {
        if (!action.payload) return;
        const token = action.payload.token;
        state.tokens[token] = action.payload;
        state.loading = false;
      })
      .addCase(calculateUserTokenDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      });
  },
});

export default accountSlice.reducer;

export const { fetchAccountSuccess } = accountSlice.actions;

const baseInfo = (state: RootState) => state.account;

export const getAccountState = createSelector(baseInfo, account => account);

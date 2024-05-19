import { Cl } from '@stacks/transactions';
import { describe, expect, it } from 'vitest';

const contract = "composable-fungible-token";
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get('wallet_1')!;
const address2 = accounts.get('wallet_2')!;
const address3 = accounts.get('wallet_3')!;
const quintillion = BigInt(1000000000000000000); /// decimals

describe('Test deployment conditions', () => {
    it('Correct constants', () => {
        const name = simnet.callReadOnlyFn(contract, 'get-name', [], deployer);
        expect(name.result).toBeAscii("MyToken");
        const symbol = simnet.callReadOnlyFn(contract, "get-symbol", [], deployer);
        expect(symbol.result).toBeAscii("MTK");
        const uri = simnet.callReadOnlyFn(contract, 'get-uri', [], deployer);
        expect(uri.result).toBeAscii("ipfs://QmXwNHQ1BmE2hLRykAMMxjsmdeDGFSFg63KDMBUhtcMcKc");
    });
    it('Correct initial supply', () => {
        const initialSupply = simnet.callReadOnlyFn(contract, 'get-total-supply', [], deployer);
        expect(initialSupply.result).toBeUint(BigInt(3) * quintillion);
    });
    it('Correct initial ownership', () => {
        const address1Balance = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address1)], deployer);
        expect(address1Balance.result).toBeUint(BigInt(2) * quintillion);
        const address2Balance = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address2)], deployer);
        expect(address2Balance.result).toBeUint(BigInt(1) * quintillion);
    });
});

describe('Test transfer-token', () => {
    it('Transfering zero tokens fail', () => {
        const response = simnet.callPublicFn(contract, 'transfer-token', [Cl.uint(0), Cl.principal(address3)], address1);
        expect(response.result).toBeErr(Cl.bool(false));
    });
    it('Non-owner fails to transfer tokens', () => {
        const response = simnet.callPublicFn(
            contract, 'transfer-token', [Cl.uint(BigInt(1) * quintillion), Cl.principal(address3)], address3
        );
        expect(response.result).toBeErr(Cl.bool(false));
    });
    it('Successful transfer of tokens', () => {
        const address1BalanceBefore = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address1)], deployer);
        expect(address1BalanceBefore.result).toBeUint(BigInt(2) * quintillion);
        const address3BalanceBefore = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address3)], deployer);
        expect(address3BalanceBefore.result).toBeUint(0);
        const supplyBefore = simnet.callReadOnlyFn(contract, 'get-total-supply', [], deployer);
        expect(supplyBefore.result).toBeUint(BigInt(3) * quintillion);

        const response = simnet.callPublicFn(
            contract, 'transfer-token', [Cl.uint(BigInt(1) * quintillion), Cl.principal(address3)], address1
        );
        expect(response.result).toBeOk(Cl.bool(true));

        const address1BalanceAfter = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address1)], deployer);
        expect(address1BalanceAfter.result).toBeUint(BigInt(1) * quintillion);
        const address3BalanceAfter = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address1)], deployer);
        expect(address3BalanceAfter.result).toBeUint(BigInt(1) * quintillion);
        const supplyAfter = simnet.callReadOnlyFn(contract, 'get-total-supply', [], deployer);
        expect(supplyAfter.result).toBeUint(BigInt(3) * quintillion);
    });
});

describe('Test approve', () => {
    it('Approve zero tokens fail', () => {
        const response = simnet.callPublicFn(contract, 'approve', [Cl.uint(0), Cl.principal(address1)], address1);
        expect(response.result).toBeErr(Cl.bool(false));
    });
    it('Successful approval', () => {
        const amount = BigInt(2) * quintillion;

        const response = simnet.callPublicFn(contract, 'approve', [Cl.uint(amount), Cl.principal(address1)], address1);
        expect(response.result).toBeOk(Cl.uint(amount));
        expect(response.events).toHaveLength(1);
        expect(response.events[0].data.value).toBeBool(true);

        const allowanceByAddress1ForAddress1 = simnet.callPrivateFn(
            contract, 'allowance', [Cl.principal(address1), Cl.principal(address1)], deployer
        );
        expect(allowanceByAddress1ForAddress1.result).toBeUint(amount);
    });
    it('Successful stacking of approvals', () => {
        const amount = BigInt(2) * quintillion;

        const response0 = simnet.callPublicFn(contract, 'approve', [Cl.uint(amount), Cl.principal(address1)], address1);
        expect(response0.result).toBeOk(Cl.uint(amount));
        expect(response0.events).toHaveLength(1);
        expect(response0.events[0].data.value).toBeBool(true);

        const response1 = simnet.callPublicFn(contract, 'approve', [Cl.uint(amount), Cl.principal(address1)], address1);
        expect(response1.result).toBeOk(Cl.uint(amount));
        expect(response1.events).toHaveLength(1);
        expect(response1.events[0].data.value).toBeBool(true);
        
        const allowanceByAddress1ForAddress1 = simnet.callPrivateFn(
            contract, 'allowance', [Cl.principal(address1), Cl.principal(address1)], deployer
        );
        expect(allowanceByAddress1ForAddress1.result).toBeUint(BigInt(2) * amount);
    });
});

describe('Test revoke', () => {
    it('Revoke non-existent allowance fails', () => {
        const response = simnet.callPublicFn(
            contract, 'revoke', [Cl.principal(address1)], address1
        );
        expect(response.result).toBeErr(Cl.bool(false));
    });
    it('Successful revoke', () => {
        const amount = BigInt(2) * quintillion;

        simnet.callPublicFn(contract, 'approve', [Cl.uint(amount), Cl.principal(address2)], address1);
        const allowanceByAddress1ForAddress2Before = simnet.callPrivateFn(
            contract, 'allowance', [Cl.principal(address2), Cl.principal(address1)], deployer
        );
        expect(allowanceByAddress1ForAddress2Before.result).toBeUint(amount);

        const response = simnet.callPublicFn(
            contract, 'revoke', [Cl.principal(address2)], address1
        );
        expect(response.result).toBeOk(Cl.uint(0));
        expect(response.events).toHaveLength(1);
        expect(response.events[0].data.value).toBeBool(true);

        const allowanceByAddress1ForAddress2After = simnet.callPrivateFn(
            contract, 'allowance', [Cl.principal(address2), Cl.principal(address1)], deployer
        );
        expect(allowanceByAddress1ForAddress2After.result).toBeUint(0);
    });
});

describe('Test transfer-from', () => {
    it('Transfer without approval fails to transfer tokens', () => {
        const response = simnet.callPublicFn(
            contract, 'transfer-from', [Cl.uint(quintillion), Cl.principal(address1), Cl.principal(address3)], address3
        );
        expect(response.result).toBeErr(Cl.bool(false));
    });
    it('Transfering zero tokens fail', () => {
        simnet.callPublicFn(contract, 'approve', [Cl.uint(quintillion), Cl.principal(address1)], address1);

        const response = simnet.callPublicFn(
            contract, 'transfer-from', [Cl.uint(0), Cl.principal(address1), Cl.principal(address3)], address1
        );
        expect(response.result).toBeErr(Cl.bool(false));
    });
    it('Succesful transfer', () => {
        const amount = BigInt(2) * quintillion;

        const address1BalanceBefore = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address1)], deployer);
        expect(address1BalanceBefore.result).toBeUint(amount);
        const address3BalanceBefore = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address3)], deployer);
        expect(address3BalanceBefore.result).toBeUint(0);
        
        simnet.callPublicFn(contract, 'approve', [Cl.uint(amount), Cl.principal(address3)], address1);

        const response = simnet.callPublicFn(
            contract, 'transfer-from', [Cl.uint(amount), Cl.principal(address1), Cl.principal(address3)], address3
        );
        expect(response.result).toBeOk(Cl.bool(true));

        const allowanceByAddress1ForAddress3 = simnet.callPrivateFn(
            contract, 'allowance', [Cl.principal(address1), Cl.principal(address3)], deployer
        );
        expect(allowanceByAddress1ForAddress3.result).toBeUint(0);

        const address1BalanceAfter = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address1)], deployer);
        expect(address1BalanceAfter.result).toBeUint(0);
        const address3BalanceAfter = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address3)], deployer);
        expect(address3BalanceAfter.result).toBeUint(amount);
    });
});

describe('Test mint', () => {
    it('Mint zero tokens fails', () => {
        const response = simnet.callPrivateFn(
            contract, 'mint', [Cl.uint(0), Cl.principal(address3)], deployer
        );
        expect(response.result).toBeErr(Cl.bool(false));
    }); 
    it('Successful mint', () => {
        const address3BalanceBefore = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address3)], deployer);
        expect(address3BalanceBefore.result).toBeUint(0);
        const supplyBefore = simnet.callReadOnlyFn(contract, 'get-total-supply', [], deployer);
        expect(supplyBefore.result).toBeUint(BigInt(3) * quintillion);

        const response = simnet.callPrivateFn(
            contract, 'mint', [Cl.uint(quintillion), Cl.principal(address3)], deployer
        );
        expect(response.result).toBeOk(Cl.uint(quintillion));

        const address3BalanceAfter = simnet.callReadOnlyFn(contract, 'get-balance', [Cl.principal(address3)], deployer);
        expect(address3BalanceAfter.result).toBeUint(quintillion);
        const supplyAfter = simnet.callReadOnlyFn(contract, 'get-total-supply', [], deployer);
        expect(supplyAfter.result).toBeUint(BigInt(4) * quintillion);
    }); 
});
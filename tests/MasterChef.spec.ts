import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, toNano } from '@ton/core';
import { MasterChef } from '../wrappers/MasterChef';
import { MiniChef } from '../wrappers/MiniChef';
import { JettonWalletUSDT } from '../wrappers/JettonWallet';
import { JettonMasterUSDT } from '../wrappers/JettonMaster';
import '@ton/test-utils';
import { Deploy } from '../build/Jetton/tact_JettonWalletUSDT';

describe('PoolFactory', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let masterChef: SandboxContract<MasterChef>;
    let usdt: SandboxContract<JettonMasterUSDT>;
    let masterChefJettonWallet: SandboxContract<JettonWalletUSDT>;

    async function jettonTransfer(
        usdt: SandboxContract<JettonMasterUSDT>,
        user: SandboxContract<TreasuryContract>,
        masterChef: SandboxContract<MasterChef>,
    ) {
        await usdt.send(user.getSender(), { value: toNano('1') }, 'Mint:1');
        const userJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(user.address, usdt.address));
        return await userJettonWallet.send(
            user.getSender(),
            { value: toNano('1.1') },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                amount: 1n * 10n ** 6n,
                destination: masterChef.address,
                response_destination: user.address,
                custom_payload: null,
                forward_ton_amount: toNano('1'),
                forward_payload: beginCell().endCell(),
            },
        );
    }

    async function addPool(
        masterChef: SandboxContract<MasterChef>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
    ) {
        return await masterChef.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddPool',
                lpTokenAddress: masterChefJettonWallet.address,
                allocPoint: 100n,
            },
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');
        masterChef = blockchain.openContract(await MasterChef.fromInit(deployer.address, 100n));
        usdt = blockchain.openContract(await JettonMasterUSDT.fromInit(deployer.address, beginCell().endCell()));
        masterChefJettonWallet = blockchain.openContract(
            await JettonWalletUSDT.fromInit(masterChef.address, usdt.address),
        );

        const deployResult = await masterChef.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterChef.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and poolFactory are ready to use
    });

    it('Should add pool', async () => {
        const addPoolResult = await masterChef.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddPool',
                lpTokenAddress: masterChefJettonWallet.address,
                allocPoint: 100n,
            },
        );

        expect(addPoolResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterChef.address,
            success: true,
            op: 1266490084,
        });
    });

    it('Should deposit', async () => {
        await addPool(masterChef, masterChefJettonWallet);
        const jettonTransferResult = await jettonTransfer(usdt, user, masterChef);
        printTransactionFees(jettonTransferResult.transactions);
        expect(jettonTransferResult.transactions).toHaveTransaction({
            from: user.address,
            to: masterChef.address,
            success: true,
        });
    });

    it('Should deposit and harvest', async () => {});

    it('Should deposit and withdraw', async () => {});

    it('Should deposit and withdarw with harvest', async () => {});
});

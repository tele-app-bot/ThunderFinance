import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, toNano } from '@ton/core';
import { MasterChef, PoolInfo } from '../wrappers/MasterChef';
import { MiniChef } from '../wrappers/MiniChef';
import { JettonWalletUSDT } from '../wrappers/JettonWallet';
import { JettonMasterUSDT } from '../wrappers/JettonMaster';
import '@ton/test-utils';
import exp from 'constants';

describe('MasterChef', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let masterChef: SandboxContract<MasterChef>;
    let miniChef: SandboxContract<MiniChef>;
    let usdt: SandboxContract<JettonMasterUSDT>;
    let masterChefJettonWallet: SandboxContract<JettonWalletUSDT>;
    let deployerJettonWallet: SandboxContract<JettonWalletUSDT>;
    let rewardPerSecond: bigint;

    async function depositJettonTransfer(
        usdt: SandboxContract<JettonMasterUSDT>,
        user: SandboxContract<TreasuryContract>,
        masterChef: SandboxContract<MasterChef>,
        amount: bigint,
    ) {
        await usdt.send(user.getSender(), { value: toNano('1') }, 'Mint:1');
        const userJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(user.address, usdt.address));
        return await userJettonWallet.send(
            user.getSender(),
            { value: toNano('1.1') },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                amount: amount,
                destination: masterChef.address,
                response_destination: user.address,
                custom_payload: null,
                forward_ton_amount: toNano('1'),
                forward_payload: beginCell().endCell(),
            },
        );
    }

    async function setup(
        masterChef: SandboxContract<MasterChef>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
    ) {
        return await masterChef.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetUp',
                rewardWallet: masterChefJettonWallet.address,
                rewardDecimal: 6n,
            },
        );
    }

    async function initialize(
        masterChef: SandboxContract<MasterChef>,
        deployerJettonWallet: SandboxContract<JettonWalletUSDT>,
        deployer: SandboxContract<TreasuryContract>,
        rewardPerSecond = 1n * 10n ** 5n,
        rewardPeriod = 1000,
    ) {
        const deadline = blockchain.now!! + rewardPeriod;
        const rewardAmount = rewardPerSecond * BigInt(rewardPeriod);
        const initResult = await deployerJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('1.5'),
            },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                amount: rewardAmount,
                destination: masterChef.address,
                response_destination: deployer.address,
                custom_payload: null,
                forward_ton_amount: toNano('1'),
                forward_payload: beginCell().storeCoins(rewardPerSecond).storeUint(deadline, 64).endCell(),
            },
        );

        const masterChefData = await masterChef.getGetMasterChefData();
        return masterChefData.isInitialized;
    }

    async function addPool(
        masterChef: SandboxContract<MasterChef>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
        allocPoint = 100n,
    ) {
        return await masterChef.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddPool',
                lpTokenAddress: masterChefJettonWallet.address,
                allocPoint: allocPoint,
            },
        );
    }

    async function deposit(
        masterChef: SandboxContract<MasterChef>,
        user: SandboxContract<TreasuryContract>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
        usdt: SandboxContract<JettonMasterUSDT>,
        userDepositAmount = 1n * 10n ** 6n,
    ) {
        await addPool(masterChef, masterChefJettonWallet);
        return await depositJettonTransfer(usdt, user, masterChef, userDepositAmount);
    }

    async function withdraw(
        masterChef: SandboxContract<MasterChef>,
        user: SandboxContract<TreasuryContract>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
        userWithdrawAmount = 5n * 10n ** 5n,
    ) {
        return await masterChef.send(
            user.getSender(),
            { value: toNano('1') },
            {
                $$type: 'Withdraw',
                queryId: 0n,
                lpTokenAddress: masterChefJettonWallet.address,
                amount: userWithdrawAmount,
                beneficiary: user.address,
            },
        );
    }

    async function harvest(
        masterChef: SandboxContract<MasterChef>,
        user: SandboxContract<TreasuryContract>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
    ) {
        return await masterChef.send(
            user.getSender(),
            { value: toNano('1') },
            {
                $$type: 'Harvest',
                queryId: 0n,
                lpTokenAddress: masterChefJettonWallet.address,
                beneficiary: user.address,
            },
        );
    }

    async function withdrawInternalReplyByUser(
        masterChef: SandboxContract<MasterChef>,
        user: SandboxContract<TreasuryContract>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
        userWithdrawAmount = 5n * 10n ** 5n,
    ) {
        return await masterChef.send(
            user.getSender(),
            { value: toNano('1') },
            {
                $$type: 'WithdrawInternalReply',
                queryId: 0n,
                lpTokenAddress: masterChefJettonWallet.address,
                amount: userWithdrawAmount,
                sender: user.address,
                rewardDebt: 0n,
                beneficiary: user.address,
            },
        );
    }

    async function harvestInternalReplyByUser(
        masterChef: SandboxContract<MasterChef>,
        user: SandboxContract<TreasuryContract>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
    ) {
        return await masterChef.send(
            user.getSender(),
            { value: toNano('1') },
            {
                $$type: 'HarvestInternalReply',
                queryId: 0n,
                lpTokenAddress: masterChefJettonWallet.address,
                beneficiary: user.address,
                reward: 100000n,
                sender: user.address,
            },
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = Math.floor(Date.now() / 1000);
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');
        usdt = blockchain.openContract(await JettonMasterUSDT.fromInit(deployer.address, beginCell().endCell()));
        masterChef = blockchain.openContract(await MasterChef.fromInit(deployer.address));
        masterChefJettonWallet = blockchain.openContract(
            await JettonWalletUSDT.fromInit(masterChef.address, usdt.address),
        );
        rewardPerSecond = 1n * 10n ** 5n;

        await usdt.send(deployer.getSender(), { value: toNano('1') }, 'Mint:1');
        deployerJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(deployer.address, usdt.address));

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

        const setUpResult = await setup(masterChef, masterChefJettonWallet);
        expect(setUpResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterChef.address,
            success: true,
            op: 0xb2d7f2a9,
        });

        const isInitialized = await initialize(masterChef, deployerJettonWallet, deployer, rewardPerSecond);
        expect(isInitialized).toBe(true);
    });

    it('Should owner add pool into master chef', async () => {
        const allocPoint = 100n;
        const addPoolResult = await addPool(masterChef, masterChefJettonWallet, allocPoint);
        // Send AddPool to MasterChef
        expect(addPoolResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterChef.address,
            success: true,
            op: 0x4b7d1ae4,
        });

        let poolData: PoolInfo = await masterChef.getGetPoolInfo(masterChefJettonWallet.address);
        // allocPoint should be equal to 100
        expect(poolData.allocPoint).toBe(allocPoint);

        // poolData.lpToken should be equal to masterChefJettonWallet.address
        expect(poolData.lpTokenAddress.toString()).toBe(masterChefJettonWallet.address.toString());
    });

    it('Should user deposit usdt to master chef and update pool', async () => {
        const userDepositAmount = 1n * 10n ** 6n;
        const periodTime = 10;
        const depositResult = await deposit(masterChef, user, masterChefJettonWallet, usdt, userDepositAmount);
        // send the deposit to MasterChef
        expect(depositResult.transactions).toHaveTransaction({
            from: masterChefJettonWallet.address,
            to: masterChef.address,
            success: true,
        });

        const miniChef = blockchain.openContract(await MiniChef.fromInit(user.address));
        // check if masterchef send userDeposit to minichef
        expect(depositResult.transactions).toHaveTransaction({
            from: masterChef.address,
            to: miniChef.address,
            success: true,
        });

        const userInfo = await miniChef.getGetUserInfo(masterChefJettonWallet.address);
        // check the user deposit amount is correct
        expect(userInfo.amount).toBe(userDepositAmount);
        // check the reqardDeft is zero
        expect(userInfo.rewardDebt).toBe(0n);

        const poolDataBefore: PoolInfo = await masterChef.getGetPoolInfo(masterChefJettonWallet.address);
        blockchain.now = Math.floor(Date.now() / 1000) + periodTime;
        // user send update Pool to masterchef
        const updatePoolResult = await masterChef.send(
            user.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'UpdatePool',
                lpTokenAddress: masterChefJettonWallet.address,
            },
        );
        // check user send update Pool to masterchef is updated
        expect(updatePoolResult.transactions).toHaveTransaction({
            from: user.address,
            to: masterChef.address,
            success: true,
        });
        const poolDataAfter: PoolInfo = await masterChef.getGetPoolInfo(masterChefJettonWallet.address);
        // check the accRewardPerShare is updated
        expect(poolDataAfter.accRewardPerShare).toBeGreaterThanOrEqual(
            poolDataBefore.accRewardPerShare + BigInt(periodTime) * rewardPerSecond,
        );
    });

    it('Should deposit and harvest', async () => {
        await addPool(masterChef, masterChefJettonWallet);
        const userDepositAmount = 1n * 10n ** 6n;
        const periodTime = 10;
        await depositJettonTransfer(usdt, user, masterChef, userDepositAmount);
        // Update time to periodTime, so that we can harvest
        blockchain.now = Math.floor(Date.now() / 1000) + periodTime;
        const userJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(user.address, usdt.address));
        const userUSDTBalanceBefore = (await userJettonWallet.getGetWalletData()).balance;

        // User send Harvest to MasterChef
        const harvestResult = await harvest(masterChef, user, masterChefJettonWallet);

        // Check if the user send Harvest to MasterChef
        expect(harvestResult.transactions).toHaveTransaction({
            from: user.address,
            to: masterChef.address,
            success: true,
        });

        // Check if the MasterChef send HarvestInternal to MiniChef
        const miniChef = blockchain.openContract(await MiniChef.fromInit(user.address));
        expect(harvestResult.transactions).toHaveTransaction({
            from: masterChef.address,
            to: miniChef.address,
            success: true,
        });

        // Check if MiniChef send HarvestInternalReply to user
        expect(harvestResult.transactions).toHaveTransaction({
            from: miniChef.address,
            to: masterChef.address,
            success: true,
        });

        // Check that MasterChef send JettonTransfer to user
        expect(harvestResult.transactions).toHaveTransaction({
            from: masterChef.address,
            to: masterChefJettonWallet.address,
            success: true,
        });

        // Check that MasterChef JettonWallet send JettonTransfer to user
        expect(harvestResult.transactions).toHaveTransaction({
            from: masterChefJettonWallet.address,
            to: userJettonWallet.address,
            success: true,
        });

        // User JettonWallet should have received the reward
        const userUSDTBalanceAfter = (await userJettonWallet.getGetWalletData()).balance;
        const benifit = (userDepositAmount * BigInt(periodTime) * rewardPerSecond) / 10n ** 6n;
        expect(userUSDTBalanceAfter).toBeGreaterThanOrEqual(userUSDTBalanceBefore + benifit);
    });

    it('Should deposit and withdraw', async () => {
        const userDepositAmount = 1n * 10n ** 6n;
        const userWithdrawAmount = 5n * 10n ** 5n;
        const periodTime = 10;
        const userJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(user.address, usdt.address));
        // deposit first
        await deposit(masterChef, user, masterChefJettonWallet, usdt, userDepositAmount);
        // get the balance of usdt before withdraw
        const userUSDTBalanceBefore = (await userJettonWallet.getGetWalletData()).balance;

        // withdraw
        blockchain.now = Math.floor(Date.now() / 1000) + periodTime;
        const withdrawResult = await withdraw(masterChef, user, masterChefJettonWallet, userWithdrawAmount);
        printTransactionFees(withdrawResult.transactions);
        // check the depositAndWithdrawResult is sucess
        expect(withdrawResult.transactions).toHaveTransaction({
            from: user.address,
            to: masterChef.address,
            success: true,
            op: 0x097bb407,
        });

        const userUSDTBalanceAfter = (await userJettonWallet.getGetWalletData()).balance;

        // check the differnce between userUSDTBalanceBefore and userUSDTBalanceAfter is equal to userWithdrawAmount
        expect(userUSDTBalanceAfter).toEqual(userUSDTBalanceBefore + userWithdrawAmount);
    });

    it('Should deposit and withdarw with harvest', async () => {
        const userDepositAmount = 1n * 10n ** 6n;
        const userWithdrawAmount = 5n * 10n ** 5n;
        const periodTime = 10;
        const userJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(user.address, usdt.address));
        // deposit first
        await deposit(masterChef, user, masterChefJettonWallet, usdt, userDepositAmount);
        // get the balance of usdt before withdraw
        const userUSDTBalanceBeforeWithdraw = (await userJettonWallet.getGetWalletData()).balance;

        // Update time to periodTime, so that we can withdraw
        blockchain.now = Math.floor(Date.now() / 1000) + periodTime;
        // withdraw
        await withdraw(masterChef, user, masterChefJettonWallet, userWithdrawAmount);
        const userUSDTBalanceBeforeHarvest = (await userJettonWallet.getGetWalletData()).balance;

        // Update time to periodTime, so that we can harvest
        blockchain.now = Math.floor(Date.now() / 1000) + periodTime * 2;
        // User send Harvest to MasterChef
        await harvest(masterChef, user, masterChefJettonWallet);
        const userUSDTBalanceAfterHarvest = (await userJettonWallet.getGetWalletData()).balance;

        // check the differnce between userUSDTBalanceBeforeWithdraw and userUSDTBalanceAfterHarvest is equal to userWithdrawAmount
        expect(userUSDTBalanceBeforeHarvest).toEqual(userUSDTBalanceBeforeWithdraw + userWithdrawAmount);
        // check the differnce between userUSDTBalanceBeforeWithdraw and userUSDTBalanceAfterHarvest is equal to userWithdrawAmount
        const remainDeposit = userDepositAmount - userWithdrawAmount;
        const benifit = ((userDepositAmount + remainDeposit) * BigInt(periodTime) * rewardPerSecond) / 10n ** 6n;
        expect(userUSDTBalanceAfterHarvest).toBeGreaterThanOrEqual(userUSDTBalanceBeforeHarvest + benifit);
    });

    it('Should not withdraw internal reply by user', async () => {
        const userDepositAmount = 1n * 10n ** 6n;
        const userWithdrawAmount = 5n * 10n ** 5n;
        // deposit first
        await deposit(masterChef, user, masterChefJettonWallet, usdt, userDepositAmount);

        const withdrawInternalReplyResult = await withdrawInternalReplyByUser(
            masterChef,
            user,
            masterChefJettonWallet,
            userWithdrawAmount,
        );

        // check the withdrawInternalReplyResult is not sucess
        expect(withdrawInternalReplyResult.transactions).toHaveTransaction({
            from: user.address,
            to: masterChef.address,
            success: false,
            op: 0x997b0dff,
            exitCode: 33311, //unexpected sender
        });
    });

    it('should not harvest internal reply by user', async () => {
        // deposit first
        await deposit(masterChef, user, masterChefJettonWallet, usdt);

        const harvestInternalReplyResult = await harvestInternalReplyByUser(masterChef, user, masterChefJettonWallet);

        // check the harvestInternalReplyResult is not sucess
        expect(harvestInternalReplyResult.transactions).toHaveTransaction({
            from: user.address,
            to: masterChef.address,
            success: false,
            op: 0x952bcd19,
            exitCode: 33311, //unexpected sender
        });
    });
});

describe('Not enough reward', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let masterChef: SandboxContract<MasterChef>;
    let miniChef: SandboxContract<MiniChef>;
    let usdt: SandboxContract<JettonMasterUSDT>;
    let masterChefJettonWallet: SandboxContract<JettonWalletUSDT>;
    let deployerJettonWallet: SandboxContract<JettonWalletUSDT>;
    let rewardPerSecond: bigint;

    async function depositJettonTransfer(
        usdt: SandboxContract<JettonMasterUSDT>,
        user: SandboxContract<TreasuryContract>,
        masterChef: SandboxContract<MasterChef>,
        amount: bigint,
    ) {
        await usdt.send(user.getSender(), { value: toNano('1') }, 'Mint:1');
        const userJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(user.address, usdt.address));
        return await userJettonWallet.send(
            user.getSender(),
            { value: toNano('1.1') },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                amount: amount,
                destination: masterChef.address,
                response_destination: user.address,
                custom_payload: null,
                forward_ton_amount: toNano('1'),
                forward_payload: beginCell().endCell(),
            },
        );
    }

    async function setup(
        masterChef: SandboxContract<MasterChef>,
        masterChefJettonWallet: SandboxContract<JettonWalletUSDT>,
    ) {
        return await masterChef.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetUp',
                rewardWallet: masterChefJettonWallet.address,
                rewardDecimal: 6n,
            },
        );
    }

    async function initialize(
        masterChef: SandboxContract<MasterChef>,
        deployerJettonWallet: SandboxContract<JettonWalletUSDT>,
        deployer: SandboxContract<TreasuryContract>,
        rewardPerSecond = 1n * 10n ** 5n,
        rewardPeriod = 1000,
        rewardAmount = 0n,
    ) {
        const deadline = blockchain.now!! + rewardPeriod;
        const initResult = await deployerJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('1.5'),
            },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                amount: rewardAmount,
                destination: masterChef.address,
                response_destination: deployer.address,
                custom_payload: null,
                forward_ton_amount: toNano('1'),
                forward_payload: beginCell().storeCoins(rewardPerSecond).storeUint(deadline, 64).endCell(),
            },
        );

        const masterChefData = await masterChef.getGetMasterChefData();
        return masterChefData.isInitialized;
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = Math.floor(Date.now() / 1000);
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');
        usdt = blockchain.openContract(await JettonMasterUSDT.fromInit(deployer.address, beginCell().endCell()));
        masterChef = blockchain.openContract(await MasterChef.fromInit(deployer.address));
        masterChefJettonWallet = blockchain.openContract(
            await JettonWalletUSDT.fromInit(masterChef.address, usdt.address),
        );
        rewardPerSecond = 1n * 10n ** 5n;

        await usdt.send(deployer.getSender(), { value: toNano('1') }, 'Mint:1');
        deployerJettonWallet = blockchain.openContract(await JettonWalletUSDT.fromInit(deployer.address, usdt.address));

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

        const setUpResult = await setup(masterChef, masterChefJettonWallet);
        expect(setUpResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterChef.address,
            success: true,
            op: 0xb2d7f2a9,
        });
    });

    it('should not initialize if not enough reward', async () => {
        const rewardPerSecond = 1n * 10n ** 5n;
        const rewardPeriod = 1000;
        const rewardAmount = 1000n;
        const initResult = await initialize(
            masterChef,
            deployerJettonWallet,
            deployer,
            rewardPerSecond,
            rewardPeriod,
            rewardAmount,
        );

        // check if the masterChef is not initialized
        const masterChefData = await masterChef.getGetMasterChefData();
        const isInitialized = masterChefData.isInitialized;
        expect(isInitialized).toBe(false);
    });
});

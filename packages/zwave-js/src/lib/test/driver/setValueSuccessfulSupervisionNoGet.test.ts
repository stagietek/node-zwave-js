import {
	BinarySwitchCCGet,
	BinarySwitchCCSet,
	BinarySwitchCCValues,
	SupervisionCCGet,
	SupervisionCCReport,
} from "@zwave-js/cc";
import { CommandClasses, SupervisionStatus } from "@zwave-js/core";
import {
	createMockZWaveRequestFrame,
	MockNodeBehavior,
	MockZWaveFrameType,
} from "@zwave-js/testing";
import { wait } from "alcalzone-shared/async";
import { integrationTest } from "../integrationTestSuite";

integrationTest(
	"setValue with successful supervised command: expect NO validation GET",
	{
		// debug: true,
		// provisioningDirectory: path.join(
		// 	__dirname,
		// 	"__fixtures/supervision_binary_switch",
		// ),

		nodeCapabilities: {
			commandClasses: [
				CommandClasses["Binary Switch"],
				CommandClasses.Supervision,
			],
		},

		customSetup: async (driver, controller, mockNode) => {
			// Just have the node respond to all Supervision Get positively
			const respondToSupervisionGet: MockNodeBehavior = {
				async onControllerFrame(controller, self, frame) {
					if (
						frame.type === MockZWaveFrameType.Request &&
						frame.payload instanceof SupervisionCCGet
					) {
						const cc = new SupervisionCCReport(self.host, {
							nodeId: controller.host.ownNodeId,
							sessionId: frame.payload.sessionId,
							moreUpdatesFollow: false,
							status: SupervisionStatus.Success,
						});
						await self.sendToController(
							createMockZWaveRequestFrame(cc, {
								ackRequested: false,
							}),
						);
						return true;
					}
					return false;
				},
			};
			mockNode.defineBehavior(respondToSupervisionGet);
		},
		testBody: async (driver, node, mockController, mockNode) => {
			const onValueChange = jest.fn();
			node.on("value added", onValueChange);
			node.on("value updated", onValueChange);

			await node.setValue(BinarySwitchCCValues.targetValue.id, true);

			await wait(500);

			mockNode.assertReceivedControllerFrame(
				(frame) =>
					frame.type === MockZWaveFrameType.Request &&
					frame.payload instanceof SupervisionCCGet &&
					frame.payload.encapsulated instanceof BinarySwitchCCSet,
				{
					errorMessage:
						"Node should have received a supervised BinarySwitchCCSet",
				},
			);
			mockNode.assertReceivedControllerFrame(
				(frame) =>
					frame.type === MockZWaveFrameType.Request &&
					frame.payload instanceof BinarySwitchCCGet,
				{
					noMatch: true,
					errorMessage:
						"Node should NOT have received a BinarySwitchCCGet",
				},
			);

			const currentValue = node.getValue(
				BinarySwitchCCValues.currentValue.id,
			);
			expect(currentValue).toBeTrue();

			// And make sure the value event handlers are called
			expect(onValueChange).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					property: "currentValue",
					newValue: true,
				}),
			);
			expect(onValueChange).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					property: "targetValue",
					newValue: true,
				}),
			);
		},
	},
);

const { handleAutonomousSystem } = require('../core/autonomousSystem');

describe('Autonomous System Router', () => {

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    test('Should return defaults if no guildId is present (e.g. DMs)', () => {
        const message = { content: "pump it" }; // Missing guild property
        const result = handleAutonomousSystem(message);
        expect(result).toEqual({ autonomousTrigger: false, shouldRespond: false });
    });

    test('Messages increase internal heat level over time', () => {
        const message = { guild: { id: "123" }, content: "pump it" };

        // First message
        handleAutonomousSystem(message);

        // Check if heat decay timer was registered
        expect(jest.getTimerCount()).toBe(1);

        // Force math.random to a known value for testing
        const mathSpy = jest.spyOn(Math, 'random').mockImplementation(() => 0.99);

        // Second message should have higher heat -> trigger threshold
        const result = handleAutonomousSystem(message);
        expect(result.autonomousTrigger).toBe(true);

        mathSpy.mockRestore();
    });

});

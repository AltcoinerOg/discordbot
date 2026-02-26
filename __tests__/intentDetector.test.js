const { detectIntent } = require('../core/intentDetector');

describe('Intent Detector', () => {

    test('Raid active state always forces raid intent', () => {
        const result = detectIntent({ content: 'hi', raidState: { active: true }, mentioned: true });
        expect(result).toBe('raid');
    });

    test('Explicit news command returns news intent', () => {
        const result = detectIntent({ content: '!news btc', raidState: { active: false }, mentioned: false });
        expect(result).toBe('news');
    });

    test('Any message with a cashtag ($) returns crypto intent', () => {
        const result = detectIntent({ content: 'What about $ETH?', raidState: { active: false }, mentioned: false });
        expect(result).toBe('crypto');
    });

    test('Directly mentioning the bot returns ai intent', () => {
        const result = detectIntent({ content: 'how are you doing today', raidState: { active: false }, mentioned: true });
        expect(result).toBe('ai');
    });

    test('Greeting keywords trigger greeting intent', () => {
        const result = detectIntent({ content: 'hello friend', raidState: { active: false }, mentioned: false });
        expect(result).toBe('greeting');
    });

    test('FAQ words trigger faq intent', () => {
        const result = detectIntent({ content: 'when is the airdrop?', raidState: { active: false }, mentioned: false });
        expect(result).toBe('faq');
    });

    test('Random gibberish returns none intent', () => {
        const result = detectIntent({ content: 'xqcL lmaoooo', raidState: { active: false }, mentioned: false });
        expect(result).toBe('none');
    });

});

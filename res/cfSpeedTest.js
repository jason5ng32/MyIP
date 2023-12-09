
import SpeedTest from 'https://cdn.skypack.dev/@cloudflare/speedtest';

let engine = new SpeedTest({
    autoStart: false,
});

// Event listeners
engine.onRunningChange = running => {
    console.log('Speed Test is ' + (running ? 'running...' : 'finished!'));
};

engine.onResultsChange = ({ type }) => {
    console.log('Results changed: ', type);
};


engine.onFinish = results => {
    console.log('Speed Test finished: ', results.getSummary());
};

engine.onError = (e) => {
    console.log('Speed Test Error: ', e);
};

const triggerSpeedTest = () => {
    engine.play();
};

const resetSpeedTest = () => {
    engine = new SpeedTest({
        autoStart: false,
        measurements: [
            { type: 'latency', numPackets: 20 },
            { type: 'download', bytes: 5e7, count: 4 },
            { type: 'upload', bytes: 1.5e7, count: 3 }
        ]
    });
    return engine;
};

export { triggerSpeedTest, resetSpeedTest, engine };

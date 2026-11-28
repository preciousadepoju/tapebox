import Script from 'next/script';
import type { CSSProperties } from 'react';

/**
 * Landing page, ported from the Tapebox site. The markup is static; public/landing.js drives the
 * scroll scenes, canvases and the demo circuit after hydration, exactly like the original.
 */
export default function Landing() {
  return (
    <>
      <header className="hdr">
        <div className="brand">
          <button
            type="button"
            className="burger"
            id="burger"
            aria-label="Open menu"
            aria-expanded="false"
            aria-controls="menu"
          >
            <i />
          </button>
          <a className="logo" href="#top" aria-label="Tapebox home">
            <b />
            TAPEBOX
          </a>
        </div>
        <a className="pill" href="/app/playground">
          <span className="dot" />
          Open sandbox
        </a>
      </header>

      <nav className="menu" id="menu" aria-label="Sandbox">
        <ol>
          <li>
            <a href="/app/playground">
              <span className="n">01</span>
              <span className="t" data-scr="">
                Playground
              </span>
              <span className="b">Write a circuit, watch it light up</span>
            </a>
          </li>
          <li>
            <a href="/app/faucet">
              <span className="n">02</span>
              <span className="t" data-scr="">
                Faucet
              </span>
              <span className="b">Free NAND, LATCH and OKB</span>
            </a>
          </li>
          <li>
            <a href="/app/explorer">
              <span className="n">03</span>
              <span className="t" data-scr="">
                Explorer
              </span>
              <span className="b">Everything on the sandbox</span>
            </a>
          </li>
          <li>
            <a href="/app/reports">
              <span className="n">04</span>
              <span className="t" data-scr="">
                Reports
              </span>
              <span className="b">tapebox test results</span>
            </a>
          </li>
          <li>
            <a href="/app/docs">
              <span className="n">05</span>
              <span className="t" data-scr="">
                Quick-start
              </span>
              <span className="b">First chip in 5 minutes</span>
            </a>
          </li>
        </ol>
      </nav>

      <aside className="rail" aria-hidden="true">
        <div className="ring">
          <svg viewBox="0 0 46 46" aria-hidden="true">
            <circle className="tr" cx="23" cy="23" r="21" />
            <circle className="pr" id="ringp" cx="23" cy="23" r="21" />
          </svg>
          <span id="ringn">01</span>
        </div>
        <div className="ticks" id="ticks" />
      </aside>

      <main id="top">
        {/* 1 HERO */}
        <section
          className="scene"
          id="s1"
          style={{ '--h': '230' } as CSSProperties}
          aria-label="Intro"
        >
          <div className="stage">
            <div className="inner">
              <canvas className="bg" id="wafer" />
              <div className="vig" />
              <div className="copy">
                <p className="eyebrow">A free X Layer sandbox for TapeOut builders</p>
                <h1 className="h" data-reveal="">
                  <span className="ln">We take it</span>
                  <span className="ln">to the fab.</span>
                </h1>
              </div>
              <div className="hero-meta">
                <span>X LAYER FORK · CHAIN 196</span>
                <span>REAL TAPEOUT CONTRACTS</span>
              </div>
              <div className="scroll-hint">
                <i />
                Scroll
              </div>
            </div>
            <div className="shade" />
          </div>
        </section>

        {/* 2 DIE */}
        <section
          className="scene"
          id="s2"
          style={{ '--h': '240' } as CSSProperties}
          aria-label="Every die is a chip"
        >
          <div className="stage">
            <div className="edge" />
            <div className="inner">
              <canvas className="bg" id="die" />
              <div className="vig" />
              <div className="copy">
                <h2 className="h" data-reveal="">
                  <span className="ln">Every die is</span>
                  <span className="ln acc">a chip you can try.</span>
                </h2>
                <p className="lede">
                  Tapebox forks X Layer mainnet with the real TapeOut contracts. Mint free test
                  transistors and build without spending a single real NAND.
                </p>
              </div>
            </div>
            <div className="shade" />
          </div>
        </section>

        {/* 3 CIRCUIT */}
        <section
          className="scene"
          id="s3"
          style={{ '--h': '250' } as CSSProperties}
          aria-label="Write it, watch it light up, tape it out"
        >
          <div className="stage">
            <div className="edge" />
            <div className="inner">
              <canvas className="bg" id="dots" />
              <div className="cap">
                <b />
                Half adder · 5 NAND · click an input to toggle it
              </div>
              <div className="circuit-wrap" id="circuit" />
              <div className="copy">
                <h2
                  className="h"
                  data-reveal=""
                  style={{ fontSize: 'clamp(40px,6.6vw,112px)' } as CSSProperties}
                >
                  <span className="ln">Write it.</span>
                  <span className="ln acc">Watch it light up.</span>
                  <span className="ln">Tape it out.</span>
                </h2>
              </div>
            </div>
            <div className="shade" />
          </div>
        </section>

        {/* 4 60 SECONDS */}
        <section
          className="scene"
          id="s4"
          style={{ '--h': '240' } as CSSProperties}
          aria-label="Your first chip in 60 seconds"
        >
          <div className="stage">
            <div className="edge" />
            <div className="inner">
              <canvas id="embers" />
              <div className="chip3d" aria-hidden="true">
                <div className="body">
                  <div className="pins" />
                  <div className="core" />
                  <div className="lbl">TBX · NAND</div>
                </div>
              </div>
              <div className="copy">
                <h2 className="h" data-reveal="">
                  <span className="ln">Your first chip</span>
                  <span className="ln acc">in 60 seconds.</span>
                </h2>
                <div className="fade">
                  <div className="ctas">
                    <a className="btn pri" href="/app/faucet">
                      Enter the sandbox{' '}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M3 8h10M9 4l4 4-4 4" />
                      </svg>
                    </a>
                    <a className="btn sec" href="/app/docs">
                      Read the quick-start
                    </a>
                  </div>
                  <div className="cmd">
                    <code>
                      <span>$</span> npx @zevbuilds/tapebox up
                    </code>
                    <button id="copy" type="button">
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="shade" />
          </div>
        </section>

        {/* 5 STEPS */}
        <section
          className="scene"
          id="s5"
          style={{ '--h': '300' } as CSSProperties}
          aria-label="Sixty seconds, four steps"
        >
          <div className="stage">
            <div className="edge" />
            <div className="inner">
              <div className="steps">
                <div className="steps-top">
                  <h2 className="h" data-reveal="">
                    <span className="ln">Sixty seconds,</span>
                    <span className="ln acc">four steps.</span>
                  </h2>
                  <div className="clock" id="clock" aria-hidden="true">
                    00<small>s</small>
                  </div>
                </div>
                <div className="track" id="track">
                  <div className="fill" />
                  <span className="mk" style={{ left: '0%' } as CSSProperties}>
                    <em>0s</em>
                  </span>
                  <span className="mk" style={{ left: '16.67%' } as CSSProperties}>
                    <em>10s</em>
                  </span>
                  <span className="mk" style={{ left: '50%' } as CSSProperties}>
                    <em>30s</em>
                  </span>
                  <span className="mk" style={{ left: '100%' } as CSSProperties}>
                    <em>60s</em>
                  </span>
                </div>
                <div className="grid4" id="steps">
                  <div className="step">
                    <div className="t">0s</div>
                    <h3>Open the sandbox</h3>
                    <p>A burner wallet is made in your browser. No extension, no seed phrase.</p>
                  </div>
                  <div className="step">
                    <div className="t">10s</div>
                    <h3>Get free transistors</h3>
                    <p>The faucet sends test NAND, LATCH and OKB on a fork of X Layer mainnet.</p>
                  </div>
                  <div className="step">
                    <div className="t">30s</div>
                    <h3>Write a circuit</h3>
                    <p>Type a netlist and watch the gates draw themselves as a live diagram.</p>
                  </div>
                  <div className="step">
                    <div className="t">60s</div>
                    <h3>Tape it out</h3>
                    <p>Your chip runs on the real TapeOut contracts. eval(), step(), done.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="shade" />
          </div>
        </section>

        {/* 6 FEATURES */}
        <section
          className="scene"
          id="s6"
          style={{ '--h': '240' } as CSSProperties}
          aria-label="Features"
        >
          <div className="stage">
            <div className="edge" />
            <div className="inner">
              <canvas id="mosaic" />
              <div
                className="vig"
                style={
                  {
                    background:
                      'linear-gradient(180deg,rgba(5,8,6,.6),rgba(5,8,6,.3) 28%,rgba(5,8,6,.88) 62%,rgba(5,8,6,.97) 100%)',
                  } as CSSProperties
                }
              />
              <div className="feat">
                <h2 className="h" data-reveal="">
                  <span className="ln">What works</span>
                  <span className="ln">here works</span>
                  <span className="ln acc">on mainnet.</span>
                </h2>
                <ul className="flist">
                  <li>
                    <span className="k">01</span>
                    <h3>Real contracts</h3>
                    <p>A pinned fork of X Layer mainnet, so what works here works on mainnet.</p>
                  </li>
                  <li>
                    <span className="k">02</span>
                    <h3>Free test tokens</h3>
                    <p>Unlimited sandbox transistors. Never spend real NAND to try an idea.</p>
                  </li>
                  <li>
                    <span className="k">03</span>
                    <h3>tapebox test</h3>
                    <p>Truth tables and beat sequences as tests, with a GitHub Action for CI.</p>
                  </li>
                  <li>
                    <span className="k">04</span>
                    <h3>Same SDK everywhere</h3>
                    <p>tapeOut, eval and step behave the same on the fork and on mainnet.</p>
                  </li>
                </ul>
              </div>
            </div>
            <div className="shade" />
          </div>
        </section>

        {/* 7 FINALE */}
        <section
          className="scene"
          id="s7"
          style={{ '--h': '100' } as CSSProperties}
          aria-label="Go build a chip"
        >
          <div className="stage">
            <div className="edge" />
            <div className="inner">
              <canvas id="bokeh" />
              <div className="fin">
                <h2 className="h" data-reveal="">
                  <span className="ln">Go build</span>
                  <span className="ln acc">a chip.</span>
                </h2>
                <ul className="links fade">
                  <li>
                    <a className="main" href="/app/playground" data-scr="">
                      Open the playground
                    </a>
                  </li>
                  <li>
                    <a href="/app/faucet" data-scr="">
                      Get free transistors
                    </a>
                  </li>
                  <li>
                    <a href="/app/explorer" data-scr="">
                      Explorer
                    </a>
                  </li>
                  <li>
                    <a href="/app/reports" data-scr="">
                      Test reports
                    </a>
                  </li>
                  <li>
                    <a href="/app/docs" data-scr="">
                      Quick-start
                    </a>
                  </li>
                </ul>
              </div>
              <div className="foot">
                <span>Tapebox · built for the X Layer TapeOut hackathon</span>
                <span>Sandbox tokens have no value</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}

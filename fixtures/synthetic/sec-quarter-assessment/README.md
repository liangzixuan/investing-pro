# Selected-quarter synthetic fixture

Example Corporation, its filing, figures, identifiers and metadata are invented.
The raw filing and Company Facts cover a direct calendar first quarter with USD
revenue of 100,000,000 and parent net loss of 20,000,000. The visible parentheses
sit outside the inline net-income fact to exercise display-sign ownership.
`filing.xhtml.txt` retains the exact raw markup bytes; formatting that source would
change the evidence being tested.

The API integration tests acquire these strings through an in-memory transport,
then use the actual Company Facts projector, Python worker and assessment engine.
They make no SEC request and use no owner data. Source timestamps in any captured
response describe synthetic fixture processing, not a real filing acquisition.

The response JSON fixtures were captured from that actual synthetic pipeline.
They include complete support, partial income, a very large exact amount and
genuine zero. Their complete source graphs and checksums are validated by the
contracts and browser tests. They are not manually authored admission assertions
and do not demonstrate coverage of any real company.

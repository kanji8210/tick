import json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text())
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text())
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text())

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

# Community labels based on node analysis
labels = {
    0: "Shared UI Components",
    1: "Auth & Navigation",
    2: "Policy Comparison Engine",
    3: "Insured Dashboard & Detail",
    4: "Agent Dashboard",
    5: "Policy Showcase Grid",
    6: "Insurance Partners",
    7: "Quote Wizard Flow",
    8: "Notification Panel",
    9: "App Router Shell",
    10: "Policy Verification",
    11: "Product Catalog",
    12: "GraphQL Client",
    13: "App Entry Point",
    14: "React Framework",
    15: "Vite Bundler",
}

questions = suggest_questions(G, communities, labels)

report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, 'src', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}), encoding='utf-8')
print('Report updated with community labels')

# Generate HTML
if G.number_of_nodes() > 5000:
    print(f'Graph has {G.number_of_nodes()} nodes - too large for HTML viz.')
else:
    to_html(G, communities, 'graphify-out/graph.html', community_labels=labels or None)
    print('graph.html written - open in any browser')

print(f'Done: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')

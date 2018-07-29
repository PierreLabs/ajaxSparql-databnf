/*jshint esversion: 6 */
$(function() {

    $('#btn').click(function() {
        $(".card").css('opacity', '0');
        $("#rowErr").css("opacity", "0");
        d3.selectAll("svg > *").remove();
        var uri = $('#uri').val();
        sparqlData(uri);
    });
    $('#uri').keydown(function(e) { //Appuie sur entrée => click
        if (e.keyCode == 13) {
            $('#btn').click();
        }
    });



    function sparqlData(uri) {

        var nodes = []; //Les noeuds
        var links = []; //Les arcs
        var dataobj = {}; //Objet des tableaux noeuds/liens

        //http://data.bnf.fr/ark:/12148/cb11907966z Hugo
        //http://data.bnf.fr/ark:/12148/cb14793455w Giuliani
        //http://data.bnf.fr/ark:/12148/cb118900414 Balzac

        //point de terminaison
        var endpoint = "http://data.bnf.fr/sparql";
        //Préfixes
        //note: <http://rdvocab.info/ElementsGr2/> est obsolète (FRAD) mais toujours utilisé dans le modèle de données de data.bnf.fr
        var prefixes = "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> PREFIX dcterms: <http://purl.org/dc/terms/> PREFIX frad: <http://rdvocab.info/ElementsGr2/>";
        //Requête SPARQL
        var req = prefixes + " SELECT DISTINCT ?oeuvre ?titre ?nom ?resum (SAMPLE(?depic) as ?fdepic) WHERE {<" + uri + "> foaf:focus ?person; skos:prefLabel ?nom . ?oeuvre dcterms:creator ?person; rdfs:label ?titre . OPTIONAL { ?person frad:biographicalInformation ?resum.} OPTIONAL { ?person foaf:depiction ?depic. }} ORDER BY RAND() LIMIT 100";

        //Envoi de la requête (asynchrone avec promesse)
        $.ajax({
            url: endpoint,
            dataType: 'json',
            data: {
                queryLn: 'SPARQL',
                query: req,
                limit: 'none',
                infer: 'true',
                Accept: 'application/sparql-results+json'
            },
            success: graphResultat,
            error: displayError
        });

        function displayError(xhr, textStatus, errorThrown) {
            console.log(textStatus);
            console.log(errorThrown);
        }

        function graphResultat(oeuvres) {

            if ((oeuvres.results.bindings.length)) { //S'il y a des résultats
                $.each(oeuvres.results.bindings, function(i, oeuvre) {
                    if (i === 0) {
                        //depiction auteur + abstract
                        $("#depic").attr('src', oeuvre.fdepic.value);
                        $(".card-title").html(oeuvre.nom.value);
                        $(".card-text").html(oeuvre.resum.value);
                        $(".card").css('opacity', '1');

                        //nodes index 0 = auteur
                        nodes.push({ id: oeuvre.nom.value, uri: uri, group: "auteur" });
                        nodes.push({ id: oeuvre.titre.value, uri: oeuvre.oeuvre.value, group: "oeuvre" });
                    } else {
                        nodes.push({ id: oeuvre.titre.value, uri: oeuvre.oeuvre.value, group: "oeuvre" });
                    }
                    links.push({ source: oeuvre.nom.value, target: oeuvre.titre.value, value: "Créateur" });
                });
                var newnodes = supprDoublons(nodes, "id"); //Tableau des noeuds uniques
                dataobj = {
                    nodes: newnodes,
                    links: links
                };

                //Init D3

                var svg = d3.select("svg"),
                    width = $("#lesvg").width(), //+svg.attr("width"),
                    height = $("#lesvg").height(); //+svg.attr("height");

                var tabcouleurs = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
                var color = d3.scaleOrdinal(tabcouleurs); //d3.schemeCategory10

                var g = svg.append("g");

                //Zoom
                var zoom = d3.zoom()
                    .scaleExtent([0.8 / 2, 4])
                    .on("zoom", zoomed);

                svg.call(zoom);

                //Mise en place des forces
                var attractForce = d3.forceManyBody().strength(-500).distanceMin(25).distanceMax(200);
                var collisionForce = d3.forceCollide(20).strength(1).iterations(64);
                var simulation = d3.forceSimulation()
                    .force("link", d3.forceLink().id(function(d) {
                        return d.id;
                    }).distance(function(d) {
                        //évalue la longueur du lien en fonction de la longueur de chaine
                        return d.value.length * 10;
                    }))
                    .force("attractForce", attractForce)
                    .force("collisionForce", collisionForce)
                    .force("center", d3.forceCenter(width / 2, height / 2));

                //liens
                var link = g
                    .attr("class", "links")
                    .selectAll("line")
                    .data(dataobj.links)
                    .enter().append("line")
                    .attr("stroke-width", 1)
                    .attr("stroke", function(d) { return color(d.value); });

                //Chemins labels
                var pathT = g.selectAll(".links")
                    .data(dataobj.links)
                    .enter().append("path")
                    .attr("class", "pathT")
                    .attr("id",
                        function(d) {
                            return "path" + d.source + "_" + d.target;
                        });

                //Labels
                var label = g.selectAll("text")
                    .data(dataobj.links)
                    .enter().append("text");

                label
                    .style("font", "normal 11px Arial")
                    .style("fill", function(d) {
                        return color(d.value);
                    })
                    .attr("dy", "-5")
                    .attr("dx", "13")
                    .style('text-anchor', 'start')
                    .attr("fill-opacity", 0.75);

                label.append("textPath")
                    .attr("xlink:href",
                        function(d) {
                            return "#path" + d.source + "_" + d.target;
                        })
                    .text(function(d) {
                        return d.value + " >";
                    });

                //Noeuds
                var node = g
                    .attr("class", "nodes")
                    .selectAll("circle")
                    .data(dataobj.nodes)
                    .enter().append("circle")
                    .attr("r", function(d) { return d.group == "auteur" ? 30 : 10; })
                    .attr("fill", function(d) {
                        return color(d.id);
                    })
                    .call(d3.drag()
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended));

                //Title pour avoir l'id du noeud au survol + click redir ressource
                node
                    .on("click", function(d) {
                        window.open(d.uri, "_blank");
                    })
                    .append("title")
                    .text(function(d) {
                        return d.id;
                    });

                simulation
                    .nodes(dataobj.nodes)
                    .on("tick", ticked);

                simulation.force("link")
                    .links(dataobj.links);

            } else { //S'il n'y a pas de résultats
                $("#rowErr").css("opacity", "1");
            }

            function zoomed() {
                g.attr("transform", d3.event.transform);
            }

            function moveto(d) {
                return "M" + d.target.x + "," + d.target.y;
            }

            function lineto(d) {
                return "L" + d.source.x + "," + d.source.y;
            }

            //Fonction itération d3
            function ticked() {
                link
                    .attr("x1", function(d) {
                        return d.source.x;
                    })
                    .attr("y1", function(d) {
                        return d.source.y;
                    })
                    .attr("x2", function(d) {
                        return d.target.x;
                    })
                    .attr("y2", function(d) {
                        return d.target.y;
                    });

                node
                    .attr("cx", function(d) {
                        return d.x;
                    })
                    .attr("cy", function(d) {
                        return d.y;
                    });

                pathT
                    .attr("d",
                        function(d) {
                            return moveto(d) + lineto(d);
                        });
            }

            function dragstarted(d) {
                if (!d3.event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }

            function dragged(d) {
                d.fx = d3.event.x;
                d.fy = d3.event.y;
            }

            function dragended(d) {
                if (!d3.event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }
        }
    }

    //Fonction pour supprimer les doublons dans le tableau des noeuds
    function supprDoublons(myArr, prop) {
        return myArr.filter((obj, pos, arr) => {
            return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
        });
    }
});
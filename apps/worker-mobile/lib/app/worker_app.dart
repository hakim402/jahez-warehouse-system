import 'package:flutter/material.dart';

class WorkerApp extends StatelessWidget {
  const WorkerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Jahez Worker',
      home: Scaffold(body: Center(child: Text('Jahez Worker'))),
    );
  }
}
